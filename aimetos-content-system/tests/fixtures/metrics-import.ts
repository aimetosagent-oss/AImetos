import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MetricRecord } from "../../packages/shared/src/domain.ts";

const metrics = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../data/fixtures/content-performance.json", import.meta.url)), "utf8")
) as MetricRecord[];

export default metrics;
