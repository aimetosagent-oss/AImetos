import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importGhlOpportunities } from "../src/modules/imports/ghl-opportunities";

const db = new PrismaClient();
const csvPath = path.resolve(process.argv[2] || "C:/Users/roger/Downloads/opportunities.csv");

async function main() {
  try {
    const results = await importGhlOpportunities(db, await readFile(csvPath, "utf8"));
    console.log(`Importació GHL completada: ${results.length} oportunitats.`);
    results.forEach((result) => console.log(`${result.action}: ${result.externalId} -> ${result.opportunityId}`));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
