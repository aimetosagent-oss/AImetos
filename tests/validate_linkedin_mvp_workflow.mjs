import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const workflowPath = path.resolve(
  "workflows/linkedin-decision-makers-mvp/linkedin_decision_makers_mvp.n8n.json",
);
const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

const expectedHeaders = [
  "ID",
  "Data captura",
  "Sector",
  "Zona",
  "Nom",
  "Càrrec",
  "Empresa",
  "URL LinkedIn",
  "Ubicació",
  "Headline",
  "Estat lead",
  "Missatge LinkedIn suggerit",
  "Notes",
  "Font",
  "Duplicat?",
  "Última actualització",
];

const requiredNodes = [
  "Inici manual",
  "Entrada i configuració",
  "Validar input",
  "Executar actor Apify",
  "Consultar estat Apify",
  "Recuperar dataset Apify",
  "Netejar i deduplicar",
  "OpenAI - generar missatge",
  "Google Sheets - desar leads",
  "Resum final",
];

const names = workflow.nodes.map((node) => node.name);
if (new Set(names).size !== names.length) throw new Error("Hi ha noms de node duplicats.");
for (const name of requiredNodes) {
  if (!names.includes(name)) throw new Error(`Falta el node obligatori: ${name}`);
}

for (const [source, groups] of Object.entries(workflow.connections)) {
  if (!names.includes(source)) throw new Error(`Connexió amb origen desconegut: ${source}`);
  for (const outputs of groups.main || []) {
    for (const connection of outputs || []) {
      if (!names.includes(connection.node)) {
        throw new Error(`Connexió cap a node desconegut: ${connection.node}`);
      }
    }
  }
}

for (const node of workflow.nodes.filter((candidate) => candidate.type === "n8n-nodes-base.code")) {
  try {
    new Function(node.parameters.jsCode);
  } catch (error) {
    throw new Error(`JavaScript invàlid al node ${node.name}: ${error.message}`);
  }
}

const runCodeNode = (name, inputItems, availableNodes = {}) => {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  const $input = {
    first: () => inputItems[0],
    all: () => inputItems,
  };
  const selector = (nodeName) => {
    const items = availableNodes[nodeName];
    if (!items) throw new Error(`Mock no disponible per al node ${nodeName}`);
    return {
      first: () => items[0],
      all: () => items,
    };
  };
  return new Function("$input", "$", node.parameters.jsCode)($input, selector);
};

const validated = runCodeNode("Validar input", [{
  json: {
    sector: "SaaS B2B",
    zona: "Barcelona, Spain",
    carrecs_objectiu: "CEO, Founder; COO",
    paraules_clau: "automatització\nIA",
    limit_resultats: 5,
    apify_actor_id: "harvestapi/linkedin-profile-search",
    google_sheet_id: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
    google_sheet_tab: "Leads",
    openai_model: "gpt-5-mini",
  },
}]);
assert.deepEqual(validated[0].json.carrecs_objectiu, ["CEO", "Founder", "COO"]);
assert.equal(validated[0].json.apify_actor_id, "harvestapi~linkedin-profile-search");
assert.equal(validated[0].json.google_sheet_id, "sheet-123");

const actorItems = [
  {
    firstName: "Anna",
    lastName: "Serra",
    linkedinUrl: "https://www.linkedin.com/in/anna-serra/?trk=test",
    headline: "COO a Acme",
    location: { linkedinText: "Barcelona" },
    currentPosition: [{ companyName: "Acme" }],
    experience: [{ position: "COO", companyName: "Acme", endDate: null }],
  },
  {
    firstName: "Anna",
    lastName: "Serra",
    linkedinUrl: "https://www.linkedin.com/in/anna-serra",
    position: "COO at Acme",
  },
  {
    firstName: "Marc",
    lastName: "Puig",
    linkedinUrl: "https://www.linkedin.com/in/marc-puig",
    position: "Founder at Beta Labs",
    location: "Girona",
  },
];
const cleaned = runCodeNode(
  "Netejar i deduplicar",
  [{ json: { body: actorItems } }],
  { "Validar input": validated },
);
assert.equal(cleaned.length, 2);
assert.equal(cleaned[0].json.Empresa, "Acme");
assert.equal(cleaned[1].json.Empresa, "Beta Labs");
assert.equal(cleaned[0].json["URL LinkedIn"], "https://www.linkedin.com/in/anna-serra");

const prepared = runCodeNode("Preparar registre final", [
  {
    json: {
      ...cleaned[0].json,
      output: [{ content: [{ type: "output_text", text: `Hola Anna, ${"x".repeat(400)}` }] }],
    },
  },
  { json: { ...cleaned[1].json, error: "mock OpenAI error" } },
]);
assert.equal(prepared.length, 2);
assert.ok(Array.from(prepared[0].json["Missatge LinkedIn suggerit"]).length <= 300);
assert.match(prepared[1].json["Missatge LinkedIn suggerit"], /^Hola Marc,/);

const sheetsNode = workflow.nodes.find((node) => node.name === "Google Sheets - desar leads");
const actualHeaders = sheetsNode.parameters.columns.schema.map((column) => column.id);
if (JSON.stringify(actualHeaders) !== JSON.stringify(expectedHeaders)) {
  throw new Error("Les columnes de Google Sheets no coincideixen amb el contracte de l'MVP.");
}
if (JSON.stringify(sheetsNode.parameters.columns.matchingColumns) !== JSON.stringify(["ID"])) {
  throw new Error("Google Sheets ha de fer upsert per ID.");
}

const serialized = JSON.stringify(workflow);
for (const placeholder of [
  "APIFY_API_TOKEN",
  "OPENAI_API_KEY",
  "GOOGLE_SHEETS_CREDENTIALS",
  "APIFY_ACTOR_ID",
  "GOOGLE_SHEET_ID",
]) {
  if (!serialized.includes(placeholder)) throw new Error(`Falta el placeholder ${placeholder}.`);
}

if (serialized.includes("linkedin.com/voyager") || serialized.includes("messaging/conversations")) {
  throw new Error("El workflow no pot contenir endpoints de login o missatgeria de LinkedIn.");
}

console.log(`OK: ${workflow.nodes.length} nodes, ${actualHeaders.length} columnes i JavaScript vàlid.`);
