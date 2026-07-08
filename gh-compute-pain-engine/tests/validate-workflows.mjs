import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const requiredWorkflowFiles = [
  'n8n/workflows/01-gh-compute-pain-detector.json',
  'n8n/workflows/02-gh-compute-apollo-enrichment.json',
  'n8n/workflows/03-gh-compute-outreach-drafts.json',
  'n8n/workflows/04-gh-compute-error-handler.json'
];

const requiredPromptFiles = [
  'prompts/pain-classifier-system.md',
  'prompts/pain-classifier-user-template.md',
  'prompts/outreach-generator-system.md',
  'prompts/outreach-generator-user-template.md',
  'prompts/pain-classification-schema.json',
  'prompts/outreach-draft-schema.json'
];

const allowedNodeTypes = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.errorTrigger',
  'n8n-nodes-base.code',
  'n8n-nodes-base.set',
  'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.if',
  'n8n-nodes-base.wait',
  'n8n-nodes-base.merge',
  'n8n-nodes-base.splitInBatches',
  'n8n-nodes-base.googleSheets'
]);

for (const file of [...requiredWorkflowFiles, ...requiredPromptFiles]) {
  assert.ok(fs.existsSync(path.join(root, file)), `required file exists: ${file}`);
}

for (const file of requiredWorkflowFiles) {
  const workflowPath = path.join(root, file);
  const raw = fs.readFileSync(workflowPath, 'utf8');
  const workflow = JSON.parse(raw);

  assert.equal(workflow.active, false, `${file} disabled by default`);
  assert.equal(workflow.settings?.timezone, 'Europe/Madrid', `${file} timezone`);
  assert.ok(Array.isArray(workflow.nodes), `${file} nodes array`);

  const nodeNames = new Set(workflow.nodes.map((node) => node.name));
  for (const node of workflow.nodes) {
    assert.ok(allowedNodeTypes.has(node.type), `${file} uses allowed node type ${node.type}`);
  }

  for (const [fromNode, outputs] of Object.entries(workflow.connections || {})) {
    assert.ok(nodeNames.has(fromNode), `${file} connection source exists: ${fromNode}`);
    for (const outputGroup of Object.values(outputs)) {
      for (const output of outputGroup) {
        for (const connection of output) {
          assert.ok(nodeNames.has(connection.node), `${file} connection target exists: ${connection.node}`);
        }
      }
    }
  }

  assert.doesNotMatch(raw, /(sk-[A-Za-z0-9]|api[_-]?key["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/i, `${file} has no hard-coded secret`);
}

const codeGs = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');
const requiredHeaders = [
  'company_id', 'company_name', 'website', 'domain', 'linkedin_company_url', 'country', 'city', 'sector', 'company_size', 'source', 'first_seen_at', 'last_seen_at', 'status', 'notes',
  'signal_id', 'source_url', 'source_type', 'source_title', 'raw_text', 'pain_category', 'pain_signal', 'evidence_quote', 'evidence_strength', 'detected_at', 'analyzed_at', 'dedupe_key', 'run_id',
  'lead_id', 'decision_maker_name', 'decision_maker_role', 'linkedin_url', 'email', 'email_source', 'enrichment_status', 'pain_summary', 'pain_hypothesis', 'recommended_service', 'outreach_angle', 'score', 'priority', 'lead_status', 'outreach_status', 'next_action', 'created_at', 'updated_at',
  'workflow_name', 'started_at', 'finished_at', 'sources_requested', 'raw_items', 'new_signals', 'qualified_leads', 'errors', 'details',
  'draft_id', 'contact_name', 'contact_role', 'channel', 'language', 'subject', 'message', 'evidence_used', 'generated_at', 'reviewed_at', 'sent_at'
];

for (const header of requiredHeaders) {
  assert.ok(codeGs.includes(`'${header}'`), `Apps Script contains header ${header}`);
}

const wf01 = fs.readFileSync(path.join(root, requiredWorkflowFiles[0]), 'utf8');
const wf01Parsed = JSON.parse(wf01);
for (const node of wf01Parsed.nodes) {
  if (node.type === 'n8n-nodes-base.httpRequest') {
    assert.doesNotMatch(JSON.stringify(node.parameters), /api\.apollo\.io|APOLLO_ENRICH_ENDPOINT/i, 'workflow 01 has no active Apollo request');
  }
}

const wf02 = fs.readFileSync(path.join(root, requiredWorkflowFiles[1]), 'utf8');
assert.match(wf02, /APOLLO_ENABLED/, 'workflow 02 checks APOLLO_ENABLED');
assert.match(wf02, /APOLLO_API_KEY/, 'workflow 02 checks APOLLO_API_KEY');

const wf03 = fs.readFileSync(path.join(root, requiredWorkflowFiles[2]), 'utf8');
assert.doesNotMatch(wf03, /(send-email|smtp-send|gmail-send|outlook-send|linkedin-send|messages\/send|mail\/send)/i, 'workflow 03 has no outbound send node or send endpoint');

console.log('validate-workflows: ok');
