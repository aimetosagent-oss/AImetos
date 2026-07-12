import { spawnSync } from "node:child_process";

const commands = [
  ["scripts/lint.ts"],
  ["scripts/format-check.ts"],
  ["scripts/typecheck.ts"],
  ["scripts/db-migrate.ts"],
  ["scripts/db-seed.ts"],
  ["scripts/build.ts"],
  ["scripts/run-tests.ts"],
  ["scripts/validate-docker.ts"]
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
console.log("Full validation passed.");
