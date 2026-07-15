import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = process.cwd();
const templateDir = path.join(root, "templates");
const previewDir = path.join(root, "outputs", "apollo_template_previews");

const leadHeaders = [
  "lead_id",
  "company_name",
  "company_domain",
  "company_website",
  "company_city",
  "company_country",
  "company_sector",
  "source",
  "decision_maker_name",
  "decision_maker_first_name",
  "decision_maker_last_name",
  "decision_maker_job_title",
  "decision_maker_seniority",
  "decision_maker_department",
  "decision_maker_email",
  "decision_maker_email_status",
  "decision_maker_phone",
  "decision_maker_linkedin_url",
  "apollo_person_id",
  "apollo_organization_id",
  "apollo_status",
  "apollo_error",
  "apollo_attempts",
  "apollo_last_checked_at",
  "processed_at",
];

const statusValues = [
  "pending",
  "processing",
  "matched",
  "matched_without_email",
  "no_person_found",
  "insufficient_company_data",
  "api_error",
  "rate_limited",
  "credit_exhausted",
  "retry",
  "skipped",
  "completed",
];

const configRows = [
  ["KEY", "VALUE", "DESCRIPTION"],
  ["SOURCE_SHEET_NAME", "Hoja 1", "Pestanya existent amb empreses/leads. Nomes lectura."],
  ["APOLLO_ENABLED", "true", "Activa o desactiva Apollo"],
  ["BATCH_SIZE", 10, "Files processades per execucio"],
  ["MAX_CANDIDATES_PER_COMPANY", 10, "Candidats maxims retornats"],
  ["OVERWRITE_EXISTING_CONTACT_DATA", "false", "Permet sobreescriure dades manuals"],
  ["RECHECK_AFTER_DAYS", 90, "Dies abans de tornar a consultar"],
  ["COUNTRY_DEFAULT", "Spain", "Pais per defecte"],
  ["APOLLO_API_KEY_ENV_VAR", "APOLLO_API_KEY", "Variable d'entorn segura"],
  ["WORKFLOW_VERSION", "1.0.0", "Versio del workflow"],
];

await fs.mkdir(templateDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const workbook = Workbook.create();

const leads = workbook.worksheets.add("LEADS");
leads.getRange("A1:Y1").values = [leadHeaders];
leads.getRange("A1:Y1").format = {
  fill: "#EEF0F3",
  font: { bold: true, color: "#111827" },
  wrapText: true,
};
leads.freezePanes.freezeRows(1);
leads.getRange("A:Y").format.columnWidth = 22;
leads.getRange("U2:U1000").dataValidation = {
  rule: { type: "list", values: statusValues },
};
leads.getRange("W:W").format.numberFormat = "0";
leads.getRange("X:Y").format.numberFormat = "yyyy-mm-dd hh:mm";

const config = workbook.worksheets.add("CONFIG");
config.getRange("A1:C10").values = configRows;
config.getRange("A1:C1").format = {
  fill: "#EEF0F3",
  font: { bold: true, color: "#111827" },
  wrapText: true,
};
config.freezePanes.freezeRows(1);
config.getRange("A:A").format.columnWidth = 34;
config.getRange("B:B").format.columnWidth = 20;
config.getRange("C:C").format.columnWidth = 58;
config.getRange("A1:C10").format.borders = { preset: "all", style: "thin", color: "#D1D5DB" };

if (process.env.RENDER_PREVIEWS === "1") {
  for (const [sheetName, range] of [
    ["LEADS", "A1:Y6"],
    ["CONFIG", "A1:C10"],
  ]) {
    const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
    await fs.writeFile(
      path.join(previewDir, sheetName + ".png"),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
}

const output = await SpreadsheetFile.exportXlsx(workbook);
const workbookPath = path.join(templateDir, "Apollo_Lead_Enrichment_Template.xlsx");
await output.save(workbookPath);
await fs.rm(workbookPath + ".inspect.ndjson", { force: true });
console.log("Generated Apollo_Lead_Enrichment_Template.xlsx");
process.exitCode = 0;
