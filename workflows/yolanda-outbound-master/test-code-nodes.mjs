import fs from 'node:fs';
import path from 'node:path';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));

const loadWorkflow = (file) => JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
const codeOf = (workflow, name) => workflow.nodes.find((node) => node.name === name)?.parameters?.jsCode;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

async function runCode(jsCode, { input = [], nodes = {}, env = {}, fetchMock = async () => response(200, {}) } = {}) {
  const inputApi = { all: () => input.map((json) => ({ json })) };
  const selector = (name) => {
    const values = nodes[name] || [];
    return {
      first: () => ({ json: values[0] || {} }),
      all: () => values.map((json) => ({ json })),
      item: { json: values[0] || {} },
    };
  };
  const fn = new AsyncFunction('$input', '$env', '$', 'fetch', 'URL', jsCode);
  return await fn(inputApi, env, selector, fetchMock, URL);
}

const setBase = { GOOGLE_SHEET_ID: 'sheet', CONFIG_SHEET_NAME: 'CONFIG_CAMPAIGNS' };
const configBase = {
  campaign_key: 'TEST',
  client_name: 'Test Client',
  source_type: 'apollo',
  sheet_name: 'CLIENTE_TEST',
  offer_type: 'offer',
  sector_default: 'sector',
  landing_url: '',
  sender_profile: 'sender',
  sending_platform: 'instantly',
  platform_campaign_id: 'campaign-1',
  apollo_roles: 'Owner,CEO',
  active: true,
  daily_limit_per_account: 10,
  accounts_count: 1,
  requires_email_verification: true,
};

{
  const workflow = loadWorkflow('01_import_apify_datasets.json');
  const selected = await runCode(codeOf(workflow, 'Select campaigns'), {
    input: [{ ...configBase, campaign_key: 'MITICA', source_type: 'Apify' }],
  });
  assert(selected.length === 1 && selected[0].json.batch_limit === 10, 'Apify campaign selection failed');
  const imported = await runCode(codeOf(workflow, 'Import and normalize Apify'), {
    input: [{ row_number: 2, company_name: 'Existing', email: 'old@example.com' }],
    nodes: {
      'Loop campaigns': [{ ...selected[0].json, campaign_key: 'MITICA', sheet_name: 'CLIENTE_01_MITICA' }],
      'SET — CONFIG': [{ ...setBase, APIFY_DATASET_ID_MITICA: 'dataset-1', APIFY_DATASET_ID_NOMAD: 'dataset-2' }],
    },
    env: { APIFY_API_TOKEN_YOLANDA: 'test-token' },
    fetchMock: async () => response(200, [{ name: 'New Hotel', website: 'hotel.example', email: 'new@example.com', city: 'Roma' }]),
  });
  assert(imported.length === 1 && imported[0].json.company_name === 'New Hotel', 'Apify normalization failed');
  assert(!Object.hasOwn(imported[0].json, 'id'), 'Apify output must not contain id');
}

{
  const workflow = loadWorkflow('02_enrich_apollo_leads.json');
  let calls = 0;
  const enriched = await runCode(codeOf(workflow, 'Search and enrich Apollo'), {
    input: [{ row_number: 2, company_name: 'Example SL', website: 'https://example.com', email: '', telefono: '', lead_status: 'new' }],
    nodes: { 'Loop campaigns': [{ ...configBase, sheet_name: 'CLIENTE_03_VAMONOS_YA', batch_limit: 10 }] },
    env: { APOLLO_API_KEY_YOLANDA: 'test-key' },
    fetchMock: async () => {
      calls += 1;
      return calls === 1
        ? response(200, { people: [{ id: 'person-1', title: 'Owner' }] })
        : response(200, { person: { id: 'person-1', email: 'owner@example.com', phone: '+34123456789' } });
    },
  });
  assert(calls === 2, 'Apollo must perform search and enrichment');
  assert(enriched[0].json.row_number === 2 && enriched[0].json.email === 'owner@example.com', 'Apollo output failed');
}

{
  const workflow = loadWorkflow('03_verify_emails_neverbounce.json');
  const verified = await runCode(codeOf(workflow, 'Verify with NeverBounce'), {
    input: [{ row_number: 2, email: 'lead@example.com', email_verification_status: 'pending', platform_lead_id: '', lead_status: 'new' }],
    nodes: { 'Loop campaigns': [{ ...configBase, sheet_name: 'CLIENTE_TEST', batch_limit: 10 }] },
    env: { NEVERBOUNCE_API_KEY_YOLANDA: 'test-key' },
    fetchMock: async () => response(200, { result: 'valid' }),
  });
  assert(verified[0].json.email_verification_status === 'valid', 'NeverBounce status mapping failed');
  assert(verified[0].json.outreach_status === 'ready_to_send', 'NeverBounce gate failed');
}

{
  const workflow = loadWorkflow('04_push_verified_leads_to_instantly.json');
  const pushed = await runCode(codeOf(workflow, 'Create Instantly leads'), {
    input: [{ row_number: 2, email: 'lead@example.com', email_verification_status: 'valid', outreach_status: 'ready_to_send', platform_lead_id: '', company_name: 'Example SL' }],
    nodes: { 'Loop campaigns': [{ ...configBase, sheet_name: 'CLIENTE_TEST', batch_limit: 10 }] },
    env: { INSTANTLY_API_KEY_YOLANDA: 'test-key' },
    fetchMock: async () => response(200, { id: 'instantly-lead-1' }),
  });
  assert(pushed[0].json.platform_lead_id === 'instantly-lead-1', 'Instantly lead ID mapping failed');
  assert(pushed[0].json.outreach_status === 'queued_instantly', 'Instantly queue status failed');
}

{
  const workflow = loadWorkflow('05_instantly_events_to_sheet_ghl.json');
  const deploy = {
    ...setBase,
    GHL_LOCATION_ID_YOLANDA: 'location-1',
    headers: { 'x-yolanda-webhook-secret': 'webhook-secret' },
    body: { event_type: 'lead_interested', campaign_id: 'campaign-1', lead_email: 'lead@example.com', timestamp: '2026-07-15T10:00:00.000Z' },
  };
  const normalized = await runCode(codeOf(workflow, 'Normalize event'), {
    input: [configBase],
    nodes: { 'SET — CONFIG': [deploy] },
    env: { INSTANTLY_WEBHOOK_SECRET_YOLANDA: 'webhook-secret' },
  });
  assert(normalized[0].json.write_row && normalized[0].json._sheet_name === 'CLIENTE_TEST', 'Instantly event routing failed');
  const applied = await runCode(codeOf(workflow, 'Apply event and sync GHL'), {
    input: [{ row_number: 2, email: 'lead@example.com', company_name: 'Example SL', outreach_status: 'sent', lead_status: 'new', reply_status: '', ghl_contact_id: '' }],
    nodes: { 'Normalize event': [normalized[0].json], 'SET — CONFIG': [deploy] },
    env: { GHL_PRIVATE_INTEGRATION_TOKEN_YOLANDA: 'ghl-token' },
    fetchMock: async () => response(200, { contact: { id: 'ghl-contact-1' } }),
  });
  assert(applied[0].json.lead_status === 'interested', 'Instantly interested status failed');
  assert(applied[0].json.ghl_contact_id === 'ghl-contact-1', 'GHL contact ID mapping failed');
}

console.log('Code-node smoke tests passed for Apify, Apollo, NeverBounce, Instantly, webhook routing, and GHL upsert.');
