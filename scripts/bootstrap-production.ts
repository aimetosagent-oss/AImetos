import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

export async function bootstrapProduction(prisma: PrismaClient, config: NodeJS.ProcessEnv) {
  if (config.SEED_DEMO_DATA !== "false") throw new Error("SEED_DEMO_DATA=false és obligatori");
  const email = config.ADMIN_EMAIL?.trim().toLowerCase();
  const password = config.ADMIN_PASSWORD;
  if (!email || !email.includes("@") || email.endsWith(".local") || !password || password.length < 20 || /canvia|adminaimetos|password|contrasenya/i.test(password)) throw new Error("Defineix ADMIN_EMAIL real i ADMIN_PASSWORD aleatori de 20 caràcters o més");
  const names = ["Nuevo Lead", "Contactado", "Cita Confirmada", "Asistio a Llamada - Muy Interesado", "Asistio a Llamada - Interes medio", "Asistio a Llamada - Interes bajo", "Reagendar", "Presupuesto enviado", "Seguimiento / negociación", "Ganado / pago anticipado", "Pago completo/venta", "No cualificado / perdido"];
  const slugs = ["lead-nou", "contactat", "reunio-programada", "qualificat", "interes-medio", "interes-bajo", "reagendar", "proposta-enviada", "negociacio", "pago-anticipado", "guanyat", "perdut"];
  const probabilities = [8, 15, 23, 31, 38, 46, 54, 62, 69, 77, 85, 92];
  return prisma.$transaction(async tx => {
    // Never reseed or overwrite an existing production organisation.
    if (await tx.organization.findUnique({ where: { slug: "aimetos" } })) return "already-initialized";
    if (await tx.user.findUnique({ where: { email } })) throw new Error("L'usuari ja existeix; revisa el bootstrap manualment");
    const org = await tx.organization.create({ data: { name: "AImetos", slug: "aimetos" } });
    await tx.organizationSettings.create({ data: {
      organizationId: org.id, tradeName: "AImetos", legalName: "Roger Arnau Bach", taxId: "45646645V",
      address: "C/ Soler i Palet 15", postalCode: "08222", city: "Terrassa", country: "ES",
      timezone: "Europe/Madrid", stripeEnabled: false, smtpEnabled: false, webhooksEnabled: false,
    } });
    const user = await tx.user.create({ data: { email, name: config.ADMIN_NAME || "Roger Arnau", passwordHash: await hash(password, 12) } });
    await tx.membership.create({ data: { userId: user.id, organizationId: org.id, role: "ADMIN" } });
    const pipeline = await tx.pipeline.create({ data: { organizationId: org.id, name: "Embudo Clientes", slug: "comercial", isDefault: true } });
    await tx.pipelineStage.createMany({ data: names.map((name, position) => ({ name, slug: slugs[position], position, organizationId: org.id, pipelineId: pipeline.id, defaultProbability: probabilities[position], type: position === 10 ? "WON" : position === 11 ? "LOST" : "OPEN" })) });
    return "initialized";
  }, { timeout: 20_000 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  bootstrapProduction(prisma, process.env).then(result => console.log(JSON.stringify({ event: "production.bootstrap", result })))
    .catch(() => { console.error("Bootstrap fallit; revisa la configuració privada"); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
