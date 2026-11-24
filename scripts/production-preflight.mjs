import { pathToFileURL } from "node:url";

export function productionErrors(env) {
  const errors = [];
  if (env.NODE_ENV !== "production" || env.LOCAL_DEVELOPMENT === "true") return errors;
  if (env.PRODUCTION_DEPLOYMENT !== "true") errors.push("PRODUCTION_DEPLOYMENT=true és obligatori");
  for (const key of ["APP_URL", "AUTH_URL"]) {
    if (env[key] !== "https://crm.aimetos.com") errors.push(`${key} ha de ser https://crm.aimetos.com`);
  }
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 48 || /placeholder|development|change|canvia/i.test(env.AUTH_SECRET)) errors.push("AUTH_SECRET no és segur");
  for (const key of ["DATABASE_URL", "DIRECT_DATABASE_URL"]) {
    try {
      const url = new URL(env[key]);
      if (!["postgresql:", "postgres:"].includes(url.protocol) || !url.password || ["localhost", "127.0.0.1"].includes(url.hostname) || /^(aimetos|postgres|build)$/.test(decodeURIComponent(url.password))) errors.push(`${key} no apunta a un PostgreSQL privat amb credencials pròpies`);
    } catch { errors.push(`${key} no és vàlida`); }
  }
  if (env.SEED_DEMO_DATA !== "false") errors.push("SEED_DEMO_DATA ha de ser false");
  if (env.SEED_ON_START === "true") errors.push("No activar SEED_ON_START; usa bootstrap explícit");
  if (env.AUTH_TRUST_HOST !== "true") errors.push("AUTH_TRUST_HOST ha de ser true darrere del proxy HTTPS d'EasyPanel");
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = productionErrors(process.env);
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
}
