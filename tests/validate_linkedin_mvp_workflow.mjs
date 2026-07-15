import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const workflowPath = path.resolve(
  "workflows/linkedin-decision-makers-mvp/linkedin_decision_makers_mvp.n8n.json",
);
const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
const nativeSheetId = "1TQJGO7he2WAEyP67GpkD3ThT3bjeiVMhMdVlxGceRmA";

const requiredNodes = [
  "Inici manual",
  "Trigger setmanal",
  "Llegir Input",
  "Preparar cerca",
  "Apify - buscar leads",
  "Normalitzar leads",
  "OpenAI - missatge",
  "Unir lead i missatge",
  "Preparar registre final",
  "Guardar a Leads",
  "Resum",
];

const forbiddenFragments = [
  "linkedin.com/voyager",
  "messaging/conversations",
  "APIFY_API_TOKEN",
  "APIFY_ACTOR_ID",
  "GOOGLE_SHEET_ID",
  "GOOGLE_SHEETS_CREDENTIALS",
];

const names = workflow.nodes.map((node) => node.name);
assert.equal(new Set(names).size, names.length, "Node names must be unique");
for (const name of requiredNodes) assert.ok(names.includes(name), `Missing node: ${name}`);

for (const [source, groups] of Object.entries(workflow.connections)) {
  assert.ok(names.includes(source), `Unknown connection source: ${source}`);
  for (const outputs of groups.main || []) {
    for (const connection of outputs || []) {
      assert.ok(names.includes(connection.node), `Unknown connection target: ${connection.node}`);
    }
  }
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
for (const node of workflow.nodes.filter((candidate) => candidate.type === "n8n-nodes-base.code")) {
  new AsyncFunction(node.parameters.jsCode);
}

const runCodeNode = (name, inputItems, availableNodes = {}) => {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `Missing code node fixture: ${name}`);
  const $input = {
    first: () => inputItems[0],
    all: () => inputItems,
  };
  const selector = (nodeName) => {
    const items = availableNodes[nodeName];
    if (!items) throw new Error(`Missing mock for node ${nodeName}`);
    return {
      first: () => items[0],
      all: () => items,
    };
  };
  return new Function("$input", "$", node.parameters.jsCode)($input, selector);
};

const prepared = runCodeNode("Preparar cerca", [
  { json: { Camp: "sector", Valor: "SaaS B2B" } },
  { json: { Camp: "zona", Valor: "Barcelona" } },
  { json: { Camp: "carrecs_objectiu", Valor: "CEO, Founder, COO" } },
  { json: { Camp: "paraules_clau", Valor: "software" } },
  { json: { Camp: "limit_resultats", Valor: 5 } },
  { json: { Camp: "apify_actor_id", Valor: "harvestapi/linkedin-profile-search" } },
  { json: { Camp: "google_sheet_id", Valor: `https://docs.google.com/spreadsheets/d/${nativeSheetId}/edit` } },
  { json: { Camp: "google_sheet_tab", Valor: "Leads" } },
  { json: { Camp: "openai_model", Valor: "gpt-5-mini" } },
]);

assert.equal(prepared.length, 1);
assert.equal(prepared[0].json.zona, "Barcelona");
assert.equal(prepared[0].json.apify_actor_id, "harvestapi~linkedin-profile-search");
assert.equal(prepared[0].json.google_sheet_id, nativeSheetId);
assert.equal(prepared[0].json.limit_resultats, 5);
assert.equal(prepared[0].json.apify_max_items, 25);
assert.match(prepared[0].json.search_query, /^"Barcelona"/);
assert.ok(prepared[0].json.search_query.includes("-student"));

const rawItems = [
  {
    firstName: "Anna",
    lastName: "Serra",
    linkedinUrl: "https://www.linkedin.com/in/anna-serra/?trk=test",
    headline: "COO at Acme software",
    location: "Barcelona",
    currentPosition: [{ companyName: "Acme", position: "COO" }],
  },
  {
    firstName: "Marc",
    lastName: "Puig",
    linkedinUrl: "https://www.linkedin.com/in/marc-puig",
    headline: "Founder at Beta Labs software",
    location: "Girona",
  },
];
const normalized = runCodeNode("Normalitzar leads", [
  { json: { ...prepared[0].json, raw_items: rawItems } },
]);

assert.equal(normalized.length, 1, "Only Barcelona leads should pass the strict location filter");
assert.equal(normalized[0].json.Nom, "Anna Serra");
assert.equal(normalized[0].json["URL LinkedIn"], "https://www.linkedin.com/in/anna-serra");

const readInputNode = workflow.nodes.find((node) => node.name === "Llegir Input");
assert.equal(readInputNode.type, "n8n-nodes-base.googleSheets");
assert.ok(!readInputNode.credentials, "Google Sheets nodes should not force embedded credentials");

const apifyNode = workflow.nodes.find((node) => node.name === "Apify - buscar leads");
assert.equal(apifyNode.type, "n8n-nodes-base.code");
assert.ok(!apifyNode.credentials, "Apify node must not use n8n credentials");
for (let index = 1; index <= 8; index++) {
  const envName = `APIFY_TOKEN_CLIENT_${String(index).padStart(2, "0")}`;
  assert.ok(apifyNode.parameters.jsCode.includes(envName), `Missing Apify token rotation for ${envName}`);
}

for (const node of workflow.nodes.filter((candidate) => candidate.type === "n8n-nodes-base.googleSheets")) {
  assert.ok(!node.credentials, `Google Sheets node must not force credential: ${node.name}`);
}

const serialized = JSON.stringify(workflow);
assert.ok(serialized.includes(nativeSheetId), "Workflow does not point to native Google Sheet");
assert.ok(serialized.includes("api.openai.com/v1/responses"), "OpenAI Responses endpoint missing");
for (const fragment of forbiddenFragments) {
  assert.ok(!serialized.includes(fragment), `Forbidden/stale fragment still present: ${fragment}`);
}

console.log(`OK: ${workflow.nodes.length} simple nodes, stricter Barcelona query, Apify token rotation, and valid JS.`);
