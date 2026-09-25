import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const ignored = ["node_modules", "dist", ".git", "data/exports"];
const issues: string[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(root, path).replace(/\\/g, "/");
    if (rel.split("/").includes("node_modules") || ignored.some((entry) => rel === entry || rel.startsWith(entry + "/"))) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && /\.(ts|tsx|js|json|md|yml|yaml|css|html)$/.test(name)) {
      const text = readFileSync(path, "utf8");
      if (!text.endsWith("\n")) issues.push(rel + " has no final newline");
      if (/ +\r?$/m.test(text)) issues.push(rel + " has trailing whitespace");
    }
  }
}

walk(root);
if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}
console.log("Format checks passed.");
