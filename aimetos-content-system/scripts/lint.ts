import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const ignored = new Set(["node_modules", "dist", ".git", "data/exports"]);
const issues: string[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = path.slice(root.length + 1).replace(/\\/g, "/");
    if ([...ignored].some((entry) => rel === entry || rel.startsWith(entry + "/"))) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    if (stat.isFile() && /\.(ts|tsx|js|json|md|yml|yaml|css|html)$/.test(name)) {
      const text = readFileSync(path, "utf8");
      if (/api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9_-]{16,}/i.test(text)) issues.push(rel + " may contain a secret");
      const todoPattern = new RegExp("T" + "ODO(?!.*credential)", "i");
      if (todoPattern.test(text)) issues.push(rel + " contains a non-credential marker");
      if (text.includes("\t")) issues.push(rel + " contains tabs");
    }
  }
}

walk(root);
if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exit(1);
}
console.log("Lint checks passed.");
