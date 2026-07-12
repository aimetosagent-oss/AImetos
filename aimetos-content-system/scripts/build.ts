import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runMockContentFlow, writeReport } from "../packages/core/src/pipeline.ts";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
mkdirSync(dist, { recursive: true });
const report = await runMockContentFlow();
const reportPath = writeReport(report);
writeFileSync(
  fileURLToPath(new URL("../dist/build-manifest.json", import.meta.url)),
  JSON.stringify({ builtAt: new Date().toISOString(), reportPath, selectedIdeas: report.selectedIdeas.length }, null, 2) + "\n",
  "utf8"
);
console.log("Build completed with " + report.selectedIdeas.length + " selected ideas.");
