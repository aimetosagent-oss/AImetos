import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const roots = ["packages", "apps/api/src", "apps/worker/src"];
const files: string[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && name.endsWith(".ts")) files.push(path);
  }
}

for (const rel of roots) walk(join(root, rel));
for (const file of files) {
  await import(pathToFileURL(file).href);
}
console.log("Type import checks passed for " + files.length + " modules.");
