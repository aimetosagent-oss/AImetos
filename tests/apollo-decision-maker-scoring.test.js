const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const workflowPath = path.resolve("workflows/apollo/Apollo_Decision_Maker_Enrichment.json");
const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

const expectedHeaders = [
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

const requiredNodes = [
  "Inici manual",
  "Configuracio base",
  "Llegir CONFIG",
  "Normalitzar CONFIG",
  "Llegir font leads",
  "Llegir LEADS",
  "Preparar cues",
  "Hi ha fila?",
  "Apollo - buscar i enriquir",
  "Google Sheets - actualitzar LEADS",
  "Resum final",
];

const names = workflow.nodes.map((node) => node.name);
assert.equal(new Set(names).size, names.length, "node names are unique");
for (const name of requiredNodes) assert.ok(names.includes(name), `required node exists: ${name}`);

for (const [source, groups] of Object.entries(workflow.connections)) {
  assert.ok(names.includes(source), `connection source exists: ${source}`);
  for (const outputs of groups.main || []) {
    for (const connection of outputs || []) {
      assert.ok(names.includes(connection.node), `connection target exists: ${connection.node}`);
    }
  }
}

for (const node of workflow.nodes.filter((candidate) => candidate.type === "n8n-nodes-base.code")) {
  assert.doesNotThrow(() => new AsyncFunction("$input", "$", "$env", "fetch", node.parameters.jsCode), `valid JS in ${node.name}`);
}

const updateNode = workflow.nodes.find((node) => node.name === "Google Sheets - actualitzar LEADS");
assert.equal(updateNode.parameters.operation, "appendOrUpdate");
assert.deepEqual(updateNode.parameters.columns.matchingColumns, ["lead_id"]);
assert.deepEqual(
  updateNode.parameters.columns.schema.map((column) => column.id),
  expectedHeaders,
  "LEADS schema matches contract",
);

const readSource = workflow.nodes.find((node) => node.name === "Llegir font leads");
assert.equal(readSource.parameters.documentId.value, "={{ $json.google_sheet_id }}");
assert.equal(readSource.parameters.sheetName.value, "={{ $json.source_sheet_name }}");
const readOutput = workflow.nodes.find((node) => node.name === "Llegir LEADS");
assert.equal(readOutput.parameters.sheetName.value, "={{ $('Normalitzar CONFIG').first().json.leads_sheet_name }}");

const rawWorkflow = JSON.stringify(workflow);
assert.match(rawWorkflow, /mixed_people\/api_search/, "People API Search endpoint present");
assert.match(rawWorkflow, /people\/match/, "People Enrichment endpoint present");
assert.match(rawWorkflow, /x-api-key/, "Apollo x-api-key auth present");
assert.doesNotMatch(rawWorkflow, /Bearer\s+[A-Za-z0-9._-]{20,}/, "no hard-coded bearer token");
assert.doesNotMatch(rawWorkflow, /(sk-[A-Za-z0-9]|api[_-]?key["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,})/i, "no hard-coded secret");

const apolloNode = workflow.nodes.find((node) => node.name === "Apollo - buscar i enriquir");
const apolloCode = apolloNode.parameters.jsCode;
const helperBlock = apolloCode.slice(0, apolloCode.indexOf("async function processRow"));
const helpers = new Function(helperBlock + "\nreturn { normalizeDomain, chooseBestCandidate, minimumCompanyData, outputContact, classifyApiError, currentEmploymentMatches, buildSearchUrl, buildEnrichUrl };")();

assert.equal(helpers.normalizeDomain("https://www.Acme.com/path?q=1"), "acme.com");
assert.equal(helpers.normalizeDomain("www.example.es/"), "example.es");
assert.equal(helpers.normalizeDomain("not a domain"), "");
assert.match(helpers.buildSearchUrl({ normalized_domain: "acme.com" }, 5), /q_organization_domains_list%5B%5D=acme\.com/);
assert.match(helpers.buildEnrichUrl({ candidate: { id: "person-1" } }, { normalized_domain: "acme.com" }), /people\/match\?id=person-1/);

assert.deepEqual(
  helpers.minimumCompanyData({ company_website: "https://www.acme.com/demo" }, "Spain"),
  { ok: true, mode: "domain", domain: "acme.com", companyName: "", city: "", country: "Spain" },
);
assert.equal(helpers.minimumCompanyData({ company_name: "Acme" }, "Spain").ok, false);
assert.equal(helpers.minimumCompanyData({ company_name: "Acme", company_city: "Barcelona" }, "Spain").mode, "name_city");

const context = {
  normalized_domain: "acme.com",
  normalized_company_name: "Acme",
  company_city: "Barcelona",
  company_country: "Spain",
  company_sector: "SaaS B2B",
};

const candidates = [
  { id: "mgr", name: "Marta Manager", title: "Sales Manager", seniority: "manager", has_email: true, organization: { name: "Acme", primary_domain: "acme.com" } },
  { id: "ceo", name: "Clara CEO", title: "CEO", seniority: "c_suite", has_email: false, organization: { name: "Acme", primary_domain: "acme.com" } },
  { id: "junior", name: "Junior", title: "Junior Marketing Assistant", seniority: "entry", has_email: true, organization: { name: "Acme", primary_domain: "acme.com" } },
];
assert.equal(helpers.chooseBestCandidate(candidates, context).candidate.id, "ceo", "CEO beats manager and junior is excluded");

const founderNoEmail = helpers.chooseBestCandidate([
  { id: "founder", name: "Fiona Founder", title: "Founder", seniority: "founder", has_email: false, organization: { name: "Acme", primary_domain: "acme.com" } },
], context);
const founderOutput = helpers.outputContact({ row_number: 2, company_name: "Acme" }, founderNoEmail, {}, context, 2, "2026-07-13T00:00:00.000Z", false);
assert.equal(founderOutput.apollo_status, "matched_without_email");

const directorTie = helpers.chooseBestCandidate([
  { id: "a", name: "Ana", title: "Director", seniority: "director", has_email: false, organization: { name: "Acme", primary_domain: "acme.com" } },
  { id: "b", name: "Berta", title: "Director", seniority: "director", has_email: true, organization: { name: "Acme", primary_domain: "acme.com" } },
], context);
assert.equal(directorTie.candidate.id, "b", "verified/email hint wins tie");

assert.equal(
  helpers.chooseBestCandidate([
    { id: "recruiter", name: "Rita", title: "Recruiter", seniority: "manager", has_email: true, organization: { name: "Acme", primary_domain: "acme.com" } },
  ], context),
  null,
  "recruiter excluded outside HR sector",
);
assert.equal(
  helpers.chooseBestCandidate([
    { id: "recruiter", name: "Rita", title: "Recruiter Manager", seniority: "manager", has_email: true, organization: { name: "Acme", primary_domain: "acme.com" } },
  ], { ...context, company_sector: "Human Resources" }).candidate.id,
  "recruiter",
  "recruiter allowed for HR sector",
);

const manualPreserved = helpers.outputContact(
  { row_number: 3, company_name: "Acme", decision_maker_email: "manual@acme.com", decision_maker_name: "Manual Name" },
  helpers.chooseBestCandidate(candidates, context),
  { id: "ceo", name: "Clara CEO", email: "apollo@acme.com", email_status: "verified", title: "CEO" },
  context,
  2,
  "2026-07-13T00:00:00.000Z",
  false,
);
assert.equal(manualPreserved.decision_maker_email, "manual@acme.com");
assert.equal(manualPreserved.decision_maker_name, "Manual Name");

assert.equal(
  helpers.currentEmploymentMatches(
    { organization_id: "org-1", employment_history: [{ current: true, organization_id: "org-2", organization_name: "Other" }] },
    context,
  ),
  false,
  "non-current-company profile rejected",
);

assert.equal(helpers.classifyApiError(429, {}, false).status, "rate_limited");
assert.equal(helpers.classifyApiError(403, { message: "credits exhausted" }, false).status, "credit_exhausted");
assert.equal(helpers.classifyApiError(500, {}, false).error, "500 temporary Apollo server error");

const runApolloCode = async (inputItems, env, fetchMock) => {
  const $input = { all: () => inputItems };
  const selector = () => {
    throw new Error("No node selector expected in Apollo node test");
  };
  return await new AsyncFunction("$input", "$", "$env", "fetch", apolloCode)($input, selector, env, fetchMock);
};

(async () => {
  const insufficient = await runApolloCode([
    { json: { row_number: 2, company_name: "Only Name", config: { apollo_enabled: true, country_default: "Spain", apollo_api_key_env_var: "APOLLO_API_KEY" } } },
  ], { APOLLO_API_KEY: "test-key" }, async () => {
    throw new Error("fetch should not be called");
  });
  assert.equal(insufficient[0].json.apollo_status, "insufficient_company_data");

  const fetchCalls = [];
  const mockedFetch = async (url) => {
    fetchCalls.push(url);
    if (url.includes("mixed_people")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({
          people: [
            { id: "founder", name: "Fiona Founder", title: "Founder", seniority: "founder", has_email: true, organization: { name: "Acme", primary_domain: "acme.com" } },
          ],
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({
        person: {
          id: "founder",
          first_name: "Fiona",
          last_name: "Founder",
          name: "Fiona Founder",
          title: "Founder",
          seniority: "founder",
          email: "fiona@acme.com",
          email_status: "verified",
          linkedin_url: "https://www.linkedin.com/in/fiona-founder",
          organization_id: "org-acme",
          employment_history: [{ current: true, organization_id: "org-acme", organization_name: "Acme" }],
        },
      }),
    };
  };

  const matched = await runApolloCode([
    {
      json: {
        row_number: 2,
        company_name: "Acme",
        company_domain: "https://www.acme.com",
        company_city: "Barcelona",
        company_sector: "SaaS B2B",
        config: {
          apollo_enabled: true,
          country_default: "Spain",
          max_candidates_per_company: 10,
          overwrite_existing_contact_data: false,
          apollo_api_key_env_var: "APOLLO_API_KEY",
        },
      },
    },
  ], { APOLLO_API_KEY: "test-key" }, mockedFetch);
  assert.equal(matched[0].json.apollo_status, "matched");
  assert.equal(matched[0].json.decision_maker_email, "fiona@acme.com");
  assert.equal(fetchCalls.length, 2, "search plus one enrichment");

  console.log(`OK: ${workflow.nodes.length} nodes, ${expectedHeaders.length} LEADS columns, Apollo scoring validated.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
