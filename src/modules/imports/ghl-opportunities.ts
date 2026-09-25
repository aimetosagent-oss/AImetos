import type { PrismaClient } from "@prisma/client";

type GhlOpportunityRow = Record<string, string>;

const importDefinitions = new Map([
  ["2GEvhqbrAgtPzsS9aCoc", { companyName: "La Cabina" }],
  ["7rl88UDwYs0KGU3r0BRG", { companyName: null }],
  ["265JA3wFCtgIoX0ipWCX", { companyName: "Saló Guttié" }],
]);

export function parseCsv(content: string): GhlOpportunityRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);

  const [headers = [], ...dataRows] = rows;
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() ?? ""])),
  );
}

export function selectedGhlOpportunities(rows: GhlOpportunityRow[]) {
  return rows.flatMap((row) => {
    const externalId = row["ID de oportunidad"];
    const definition = importDefinitions.get(externalId);
    return definition ? [{ row, externalId, ...definition }] : [];
  });
}

export async function importGhlOpportunities(db: PrismaClient, csv: string) {
  const organization = await db.organization.findUnique({ where: { slug: "aimetos" } });
  if (!organization) throw new Error("No s'ha trobat l'organització AImetos.");
  const [pipeline, owner] = await Promise.all([
    db.pipeline.findFirst({
      where: {
        organizationId: organization.id,
        isActive: true,
        OR: [{ name: { equals: "Embudo Clientes", mode: "insensitive" } }, { isDefault: true }],
      },
      include: { stages: true },
    }),
    db.membership.findFirst({
      where: { organizationId: organization.id, isActive: true, user: { isActive: true } },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    }),
  ]);
  if (!pipeline) throw new Error("No s'ha trobat el pipeline Embudo Clientes.");

  const results: Array<{ externalId: string; action: "created" | "updated"; opportunityId: string }> = [];
  for (const item of selectedGhlOpportunities(parseCsv(csv))) {
    const row = item.row;
    const email = row["correo electrónico"].trim().toLowerCase();
    const phone = row["teléfono"].trim();
    const phoneNormalized = phone.replace(/[^+\d]/g, "");
    const title = row["Nombre de la oportunidad"].trim();
    const contactName = row["Nombre del contacto"].trim();
    const [firstName, ...lastNameParts] = contactName.split(/\s+/);
    const stageName = row.fase.trim();
    const stage = pipeline.stages.find((candidate) => candidate.name === stageName);
    if (!stage) throw new Error(`No existeix l'etapa ${stageName}.`);

    const result = await db.$transaction(async (tx) => {
      let companyId: string | null = null;
      if (item.companyName) {
        const existingCompany = await tx.company.findFirst({
          where: { organizationId: organization.id, name: { equals: item.companyName, mode: "insensitive" }, deletedAt: null },
        });
        const company = existingCompany ?? await tx.company.create({
          data: {
            organizationId: organization.id,
            name: item.companyName,
            source: "Importació GoHighLevel",
            ownerId: owner?.userId,
          },
        });
        companyId = company.id;
      }

      const existingContact = email
        ? await tx.contact.findUnique({
            where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: email } },
          })
        : null;
      const contact = existingContact
        ? await tx.contact.update({
            where: { id: existingContact.id },
            data: {
              firstName,
              lastName: lastNameParts.join(" ") || null,
              phone: phone || null,
              phoneNormalized: phoneNormalized || null,
              companyId,
              source: row.fuente || "Importació GoHighLevel",
              ownerId: owner?.userId,
              deletedAt: null,
            },
          })
        : await tx.contact.create({
            data: {
              organizationId: organization.id,
              firstName,
              lastName: lastNameParts.join(" ") || null,
              email: email || null,
              emailNormalized: email || null,
              phone: phone || null,
              phoneNormalized: phoneNormalized || null,
              companyId,
              source: row.fuente || "Importació GoHighLevel",
              ownerId: owner?.userId,
              preferredLanguage: "ca",
              createdAt: validDate(row["Creado el"]),
            },
          });

      const existingOpportunity = await tx.opportunity.findFirst({
        where: { organizationId: organization.id, title, contactId: contact.id, deletedAt: null },
      });
      const valueCents = Math.round(Number(row["Valor del cliente potencial"] || 0) * 100);
      const opportunityData = {
        title,
        companyId,
        contactId: contact.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        ownerId: owner?.userId,
        valueCents,
        currency: "EUR",
        probability: stage.defaultProbability,
        source: `${row.fuente || "GoHighLevel"} · GHL ${item.externalId}`,
        status: "OPEN" as const,
        lostReason: null,
        closedAt: null,
        deletedAt: null,
      };
      const opportunity = existingOpportunity
        ? await tx.opportunity.update({ where: { id: existingOpportunity.id }, data: opportunityData })
        : await tx.opportunity.create({
            data: { organizationId: organization.id, ...opportunityData, createdAt: validDate(row["Creado el"]) },
          });

      const note = row.Notas.trim();
      if (note) {
        const existingNote = await tx.note.findFirst({
          where: { organizationId: organization.id, opportunityId: opportunity.id, content: note, deletedAt: null },
        });
        if (!existingNote) await tx.note.create({
          data: { organizationId: organization.id, opportunityId: opportunity.id, contactId: contact.id, companyId, authorId: owner?.userId, content: note },
        });
      }

      return { opportunity, action: existingOpportunity ? "updated" as const : "created" as const };
    });
    results.push({ externalId: item.externalId, action: result.action, opportunityId: result.opportunity.id });
  }
  return results;
}

function validDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
