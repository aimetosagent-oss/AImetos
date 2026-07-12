import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../data/exports", import.meta.url));
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(fileURLToPath(new URL("../data/exports/.gitkeep", import.meta.url)), "", "utf8");
console.log("Mock exports reset.");
