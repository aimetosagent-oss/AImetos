import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const metrics = JSON.parse(readFileSync(fileURLToPath(new URL("../data/fixtures/content-performance.json", import.meta.url)), "utf8"));
const leads = JSON.parse(readFileSync(fileURLToPath(new URL("../data/fixtures/leads.json", import.meta.url)), "utf8"));
const target = fileURLToPath(new URL("../data/exports/mock-seed-summary.json", import.meta.url));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify({ seededAt: new Date().toISOString(), metrics: metrics.length, leads: leads.length }, null, 2) + "\n", "utf8");
console.log("Mock seed completed.");
