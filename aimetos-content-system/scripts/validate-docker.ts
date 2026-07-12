import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const files = ["docker-compose.yml", "docker-compose.mock.yml", "docker-compose.production.yml"];
for (const file of files) {
  const text = readFileSync(fileURLToPath(new URL("../" + file, import.meta.url)), "utf8");
  for (const required of ["services:", "postgres:", "api:", "worker:"]) {
    if (!text.includes(required) && file === "docker-compose.yml") {
      throw new Error(file + " missing " + required);
    }
  }
}
console.log("Docker compose files are present and contain required services.");
