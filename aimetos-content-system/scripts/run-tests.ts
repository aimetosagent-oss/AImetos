import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const files: string[] = [];
function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && name.endsWith(".test.ts")) files.push(path);
  }
}
walk(join(root, "tests"));
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", cwd: root });
process.exit(result.status || 0);
