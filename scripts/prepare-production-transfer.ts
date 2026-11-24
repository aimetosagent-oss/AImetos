import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const approvedIds = ["2GEvhqbrAgtPzsS9aCoc", "7rl88UDwYs0KGU3r0BRG", "265JA3wFCtgIoX0ipWCX"];
const db = new PrismaClient();
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Preparació permesa només des de la base local");
  const organization = await db.organization.findUniqueOrThrow({ where: { slug: "aimetos" } });
  const opportunities = await db.opportunity.findMany({
    where: { organizationId: organization.id, deletedAt: null, OR: approvedIds.map(id => ({ source: { endsWith: `GHL ${id}` } })) },
    select: {
      id: true, title: true, valueCents: true, currency: true, probability: true, source: true,
      recurringAmountCents: true, recurringInterval: true, serviceStartDate: true,
      stage: { select: { slug: true, name: true } },
      company: { select: { id: true, name: true, legalName: true, taxId: true, email: true, phone: true, address: true, city: true, postalCode: true, country: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, position: true, preferredLanguage: true } },
      notes: { where: { deletedAt: null }, select: { content: true, createdAt: true } },
    },
  });
  if (opportunities.length !== 3 || new Set(opportunities.map(o => o.contact?.id)).size !== 3) throw new Error("La selecció aprovada no coincideix amb els 3 contactes reals; revisió manual requerida");
  const allowedSkus = ["SETUP-GENERAL", "BACKOFFICE-SMART", "BACKOFFICE-CORE", "AGENT-TEXT", "AGENT-INBOUND", "INBOUND-MULTILINGUAL", "AGENT-OUTBOUND", "PACK-AUTONOM", "MAINT-BASIC", "MAINT-MEDIUM", "MAINT-PRO", "VOLUME-BASIC", "VOLUME-MEDIUM", "MONTHLY-PACK-1", "MONTHLY-PACK-2", "MONTHLY-PACK-3", "MONTHLY-PACK-4", "MONTHLY-PACK-4-PLUS", "MONTHLY-PACK-5", "MONTHLY-PACK-6"];
  const products = await db.product.findMany({ where: { organizationId: organization.id, deletedAt: null, isActive: true, sku: { in: allowedSkus } }, select: { sku: true, name: true, description: true, unitPriceCents: true, currency: true, taxRateBps: true, billingType: true }, orderBy: { sku: "asc" } });
  if (products.length !== allowedSkus.length) throw new Error("El catàleg no coincideix amb els 20 productes aprovats");
  const bundle = { format: "aimetos-approved-commercial-transfer-v1", preparedAt: new Date().toISOString(), opportunities, products, excluded: ["Roger Arnau: proves", "empreses/contactes demo i E2E", "pressupostos", "factures", "pagaments", "seqüències", "usuaris", "sessions", "credencials", "formularis i workflows"] };
  await mkdir("backups/migration", { recursive: true });
  const file = "backups/migration/approved-commercial-transfer.json";
  await writeFile(file, JSON.stringify(bundle, null, 2), { mode: 0o600 });
  console.log(`Preparat, NO importat: ${file}`);
  for (const item of opportunities) console.log(`${item.contact?.firstName} ${item.contact?.lastName ?? ""} · ${item.company?.name ?? "autònom sense empresa"} · ${item.stage.name}`);
  console.log(`Productes: ${products.length}. Cap document fiscal ni seqüència inclosos.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Preparació fallida"); process.exitCode = 1; }).finally(() => db.$disconnect());
