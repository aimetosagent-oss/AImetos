import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const SHEET_ID = '1_AjJJhspz_mM3VlTrVU6Jrynhz9PIfBWdZ0ydOesDsc';
const CONFIG_TAB = 'CONFIG_CAMPAIGNS';

const CLIENT_COLUMNS = [
  'id', 'campaign_key', 'company_name', 'website', 'email', 'telefono', 'city',
  'target_type', 'sector', 'offer_type', 'landing_url', 'source_url',
  'pain_hypothesis', 'email_verification_status', 'email_verification_provider',
  'email_verified_at', 'outreach_status', 'language', 'platform',
  'platform_campaign_id', 'platform_lead_id', 'platform_status',
  'platform_last_event', 'sender_profile', 'last_contact_date', 'lead_status',
  'reply_status', 'ghl_contact_id',
];

const CONFIG_COLUMNS = [
  'campaign_key', 'client_name', 'source_type', 'sheet_name', 'offer_type',
  'sector_default', 'landing_url', 'sender_profile', 'sending_platform',
  'platform_campaign_id', 'apollo_roles', 'active', 'daily_limit_per_account',
  'accounts_count', 'requires_pain_hypothesis', 'requires_email_verification',
];

const uuid = (seed) => crypto.createHash('sha1').update(seed).digest('hex').replace(
  /^(........)(....)(....)(....)(............).*$/,
  '$1-$2-4$3-8$4-$5',
);

const node = (workflow, name, type, typeVersion, position, parameters = {}) => ({
  parameters,
  id: uuid(`${workflow}:${name}`),
  name,
  type,
  typeVersion,
  position,
});

const manual = (workflow, position) => node(workflow, 'Manual Trigger', 'n8n-nodes-base.manualTrigger', 1, position);

const schedule = (workflow, minutes, position) => node(
  workflow,
  'Schedule Trigger',
  'n8n-nodes-base.scheduleTrigger',
  1.2,
  position,
  { rule: { interval: [{ field: 'minutes', minutesInterval: minutes }] } },
);

const editFields = (workflow, assignments, position, includeOtherFields = true) => node(
  workflow,
  'SET — CONFIG',
  'n8n-nodes-base.set',
  3.4,
  position,
  {
    assignments: {
      assignments: Object.entries(assignments).map(([name, value], index) => ({
        id: `cfg-${index + 1}`,
        name,
        value,
        type: typeof value === 'number' ? 'number' : 'string',
      })),
    },
    includeOtherFields,
    options: {},
  },
);

const code = (workflow, name, jsCode, position) => node(
  workflow,
  name,
  'n8n-nodes-base.code',
  2,
  position,
  { mode: 'runOnceForAllItems', language: 'javaScript', jsCode },
);

const ifBoolean = (workflow, name, expression, position) => node(
  workflow,
  name,
  'n8n-nodes-base.if',
  2.3,
  position,
  {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: `${uuid(`${workflow}:${name}:condition`)}`,
        leftValue: expression,
        rightValue: true,
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  },
);

const loop = (workflow, position) => node(
  workflow,
  'Loop campaigns',
  'n8n-nodes-base.splitInBatches',
  3,
  position,
  { batchSize: 1, options: { reset: false } },
);

const noop = (workflow, name, position) => node(workflow, name, 'n8n-nodes-base.noOp', 1, position, {});

const webhook = (workflow, position) => node(
  workflow,
  'Instantly Webhook',
  'n8n-nodes-base.webhook',
  2.1,
  position,
  {
    httpMethod: 'POST',
    path: 'yolanda-instantly-events-v1',
    responseMode: 'onReceived',
    options: {},
  },
);

const schema = (fields, matching = []) => fields.map((field) => ({
  id: field,
  displayName: field,
  required: matching.includes(field),
  defaultMatch: matching.includes(field),
  display: true,
  type: field === 'row_number' ? 'number' : 'string',
  canBeUsedToMatch: matching.includes(field),
}));

const sheetRead = (workflow, name, sheetExpression, position) => node(
  workflow,
  name,
  'n8n-nodes-base.googleSheets',
  4.7,
  position,
  {
    operation: 'read',
    documentId: {
      __rl: true,
      value: "={{ $('SET — CONFIG').first().json.GOOGLE_SHEET_ID }}",
      mode: 'id',
    },
    sheetName: { __rl: true, value: sheetExpression, mode: 'name' },
    options: {},
  },
);

const sheetWrite = (workflow, name, operation, sheetExpression, fields, matchField, position) => {
  const matching = matchField ? [matchField] : [];
  const parameters = {
    operation,
    documentId: {
      __rl: true,
      value: "={{ $('SET — CONFIG').first().json.GOOGLE_SHEET_ID }}",
      mode: 'id',
    },
    sheetName: { __rl: true, value: sheetExpression, mode: 'name' },
    columns: {
      mappingMode: 'defineBelow',
      value: Object.fromEntries(fields.map((field) => [field, `={{ $json.${field} }}`])),
      matchingColumns: matching,
      schema: schema(fields, matching),
      attemptToConvertTypes: false,
      convertFieldsToString: false,
    },
    options: { cellFormat: 'USER_ENTERED', handlingExtraData: 'ignoreIt' },
  };
  return node(workflow, name, 'n8n-nodes-base.googleSheets', 4.7, position, parameters);
};

const connect = (connections, from, output, to, input = 0) => {
  connections[from] ??= { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: input });
};

const baseWorkflow = (name, nodes, connections) => ({
  name,
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: {
    executionOrder: 'v1',
    timezone: 'Europe/Madrid',
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'none',
    saveManualExecutions: true,
  },
  versionId: uuid(`${name}:version`),
  meta: { templateCredsSetupCompleted: false },
  tags: [],
});

const COMMON_CONFIG_FILTER = String.raw`
const truthy = (value) => value === true || ['true', '1', 'yes', 'si', 'sí'].includes(String(value ?? '').trim().toLowerCase());
const text = (value) => String(value ?? '').trim();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

return $input.all()
  .map((item) => item.json || {})
  .filter((row) => truthy(row.active))
  .map((row) => ({
    json: {
      ...row,
      campaign_key: text(row.campaign_key),
      sheet_name: text(row.sheet_name),
      source_type: text(row.source_type).toLowerCase(),
      sending_platform: text(row.sending_platform).toLowerCase(),
      platform_campaign_id: text(row.platform_campaign_id),
      batch_limit: Math.max(1, Math.floor(number(row.daily_limit_per_account, 1) * number(row.accounts_count, 1))),
      requires_email_verification: truthy(row.requires_email_verification),
    },
  }));
`;

const APIFY_IMPORT_CODE = String.raw`
const cfg = $('Loop campaigns').first().json;
const deploy = $('SET — CONFIG').first().json;
const existingRows = $input.all().map((item) => item.json || {});
const clean = (value) => String(value ?? '').trim();
const lower = (value) => clean(value).toLowerCase();
const pick = (row, keys) => {
  for (const key of keys) {
    const value = clean(row?.[key]);
    if (value) return value;
  }
  return '';
};
const normalizeUrl = (value) => {
  const raw = clean(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return 'https://' + raw.replace(/^\/+/, '');
};
const keyOf = (row) => {
  const email = lower(row.email);
  if (email) return 'email:' + email;
  return ['lead', lower(row.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), lower(row.company_name), lower(row.city)].join('|');
};

const datasetByCampaign = {
  MITICA: clean(deploy.APIFY_DATASET_ID_MITICA),
  NOMAD_PLANET: clean(deploy.APIFY_DATASET_ID_NOMAD),
};
const datasetId = datasetByCampaign[cfg.campaign_key];
if (!datasetId || datasetId.startsWith('REPLACE_')) {
  throw new Error('Missing Apify dataset ID in SET — CONFIG for campaign ' + cfg.campaign_key);
}
const token = clean($env.APIFY_API_TOKEN_YOLANDA);
if (!token) throw new Error('Missing Easypanel environment variable APIFY_API_TOKEN_YOLANDA');

const fetchLimit = Math.max(cfg.batch_limit, cfg.batch_limit + existingRows.length);
const url = 'https://api.apify.com/v2/datasets/' + encodeURIComponent(datasetId) + '/items?clean=true&format=json&offset=0&limit=' + encodeURIComponent(String(fetchLimit));
const response = await fetch(url, { headers: { accept: 'application/json', authorization: 'Bearer ' + token } });
const bodyText = await response.text();
let body;
try { body = bodyText ? JSON.parse(bodyText) : []; } catch { body = []; }
if (!response.ok) throw new Error('Apify ' + response.status + ': ' + bodyText.slice(0, 300));
const records = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];

const existing = new Set(existingRows.map(keyOf));
const created = [];
for (const raw of records) {
  const email = lower(pick(raw, ['email', 'emailAddress', 'contactEmail', 'mail']));
  const website = normalizeUrl(pick(raw, ['website', 'websiteUrl', 'url', 'domain']));
  const row = {
    campaign_key: cfg.campaign_key,
    company_name: pick(raw, ['company_name', 'companyName', 'name', 'title']),
    website,
    email,
    telefono: pick(raw, ['telefono', 'phone', 'phoneNumber', 'telephone']),
    city: pick(raw, ['city', 'ciudad', 'location.city', 'address.city']),
    target_type: pick(raw, ['target_type', 'targetType', 'category']) || clean(cfg.sector_default),
    sector: pick(raw, ['sector', 'industry']) || clean(cfg.sector_default),
    offer_type: clean(cfg.offer_type),
    landing_url: clean(cfg.landing_url),
    source_url: pick(raw, ['source_url', 'sourceUrl', 'url', 'googleMapsUrl']) || website,
    pain_hypothesis: pick(raw, ['pain_hypothesis', 'painHypothesis']),
    email_verification_status: email ? 'pending' : '',
    email_verification_provider: '',
    email_verified_at: '',
    outreach_status: email ? 'pending_verification' : 'missing_email',
    language: lower(pick(raw, ['language', 'idioma'])) || 'es',
    platform: clean(cfg.sending_platform) || 'instantly',
    platform_campaign_id: clean(cfg.platform_campaign_id),
    platform_lead_id: '',
    platform_status: '',
    platform_last_event: '',
    sender_profile: clean(cfg.sender_profile),
    last_contact_date: '',
    lead_status: 'new',
    reply_status: '',
    ghl_contact_id: '',
  };
  const key = keyOf(row);
  if (!row.company_name || existing.has(key)) continue;
  existing.add(key);
  created.push({ json: { ...row, _sheet_name: cfg.sheet_name, write_row: true } });
  if (created.length >= cfg.batch_limit) break;
}

return created.length ? created : [{ json: { _sheet_name: cfg.sheet_name, write_row: false, reason: 'No new Apify rows' } }];
`;

const APOLLO_ENRICH_CODE = String.raw`
const cfg = $('Loop campaigns').first().json;
const rows = $input.all().map((item) => item.json || {});
const clean = (value) => String(value ?? '').trim();
const lower = (value) => clean(value).toLowerCase();
const normalizeDomain = (value) => lower(value).replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].replace(/\.+$/, '');
const roles = (() => {
  const raw = clean(cfg.apollo_roles);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
  } catch {}
  return raw.split(/[,;\n]/).map(clean).filter(Boolean);
})();
if (!roles.length) throw new Error('apollo_roles is empty in CONFIG_CAMPAIGNS for ' + cfg.campaign_key);
const apiKey = clean($env.APOLLO_API_KEY_YOLANDA);
if (!apiKey) throw new Error('Missing Easypanel environment variable APOLLO_API_KEY_YOLANDA');

async function apolloPost(base, params) {
  const url = new URL(base);
  for (const [key, value] of params) url.searchParams.append(key, value);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'x-api-key': apiKey },
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (response.ok) return data;
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    const error = new Error('Apollo ' + response.status + ': ' + raw.slice(0, 300));
    error.status = response.status;
    throw error;
  }
  throw new Error('Apollo request failed after retries');
}

const eligible = rows.filter((row) => {
  const status = lower(row.lead_status);
  return !clean(row.email) && !clean(row.platform_lead_id) && ['', 'new', 'apollo_retry'].includes(status);
}).slice(0, cfg.batch_limit);

const output = [];
for (const row of eligible) {
  const rowNumber = Number(row.row_number || row.__row_number || row._rowNumber);
  if (!rowNumber) continue;
  const domain = normalizeDomain(row.website || row.source_url);
  if (!domain) {
    output.push({ json: { row_number: rowNumber, email: '', telefono: clean(row.telefono), email_verification_status: '', email_verification_provider: '', email_verified_at: '', outreach_status: 'missing_website', lead_status: 'apollo_no_domain', _sheet_name: cfg.sheet_name, write_row: true } });
    continue;
  }
  try {
    const searchParams = [['page', '1'], ['per_page', '10'], ['q_organization_domains_list[]', domain]];
    for (const role of roles) searchParams.push(['person_titles[]', role]);
    const search = await apolloPost('https://api.apollo.io/api/v1/mixed_people/api_search', searchParams);
    const people = Array.isArray(search.people) ? search.people : [];
    const candidate = people.find((person) => clean(person.id));
    if (!candidate) {
      output.push({ json: { row_number: rowNumber, email: '', telefono: clean(row.telefono), email_verification_status: '', email_verification_provider: '', email_verified_at: '', outreach_status: 'missing_email', lead_status: 'apollo_no_match', _sheet_name: cfg.sheet_name, write_row: true } });
      continue;
    }
    const enriched = await apolloPost('https://api.apollo.io/api/v1/people/match', [['id', candidate.id], ['domain', domain], ['reveal_personal_emails', 'false'], ['reveal_phone_number', 'false']]);
    const person = enriched.person || enriched.contact || {};
    const email = lower(person.email);
    const phone = clean(person.sanitized_phone || person.phone || row.telefono);
    output.push({ json: {
      row_number: rowNumber,
      email,
      telefono: phone,
      email_verification_status: email ? 'pending' : '',
      email_verification_provider: '',
      email_verified_at: '',
      outreach_status: email ? 'pending_verification' : 'missing_email',
      lead_status: email ? 'new' : 'apollo_no_email',
      _sheet_name: cfg.sheet_name,
      write_row: true,
    } });
  } catch (error) {
    if (error.status === 401 || error.status === 403) throw error;
    output.push({ json: { row_number: rowNumber, email: '', telefono: clean(row.telefono), email_verification_status: '', email_verification_provider: '', email_verified_at: '', outreach_status: 'source_error', lead_status: 'apollo_error', _sheet_name: cfg.sheet_name, write_row: true } });
  }
}

return output.length ? output : [{ json: { _sheet_name: cfg.sheet_name, write_row: false, reason: 'No Apollo rows eligible' } }];
`;

const VERIFY_EMAIL_CODE = String.raw`
const cfg = $('Loop campaigns').first().json;
const rows = $input.all().map((item) => item.json || {});
const clean = (value) => String(value ?? '').trim();
const lower = (value) => clean(value).toLowerCase();
const apiKey = clean($env.NEVERBOUNCE_API_KEY_YOLANDA);
if (!apiKey) throw new Error('Missing Easypanel environment variable NEVERBOUNCE_API_KEY_YOLANDA');

const eligible = rows.filter((row) => {
  const status = lower(row.email_verification_status);
  return clean(row.email) && ['', 'pending', 'retry'].includes(status) && !clean(row.platform_lead_id);
}).slice(0, cfg.batch_limit);

const output = [];
for (const row of eligible) {
  const rowNumber = Number(row.row_number || row.__row_number || row._rowNumber);
  if (!rowNumber) continue;
  const checkedAt = new Date().toISOString();
  let status = 'error';
  try {
    const url = new URL('https://api.neverbounce.com/v4/single/check');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('email', lower(row.email));
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (!response.ok) throw new Error('NeverBounce ' + response.status + ': ' + raw.slice(0, 250));
    status = lower(data.result || data.status || 'unknown').replace(/[-\s]/g, '_');
    if (status === 'catchall') status = 'catch_all';
    if (!['valid', 'invalid', 'unknown', 'disposable', 'catch_all'].includes(status)) status = 'error';
  } catch {
    status = 'error';
  }
  output.push({ json: {
    row_number: rowNumber,
    email_verification_status: status,
    email_verification_provider: 'neverbounce',
    email_verified_at: checkedAt,
    outreach_status: status === 'valid' ? 'ready_to_send' : status === 'error' ? 'verification_error' : 'blocked_email_' + status,
    lead_status: status === 'valid' ? (clean(row.lead_status) || 'new') : status === 'error' ? (clean(row.lead_status) || 'new') : 'email_' + status,
    _sheet_name: cfg.sheet_name,
    write_row: true,
  } });
}

return output.length ? output : [{ json: { _sheet_name: cfg.sheet_name, write_row: false, reason: 'No emails pending verification' } }];
`;

const PUSH_INSTANTLY_CODE = String.raw`
const cfg = $('Loop campaigns').first().json;
const rows = $input.all().map((item) => item.json || {});
const clean = (value) => String(value ?? '').trim();
const lower = (value) => clean(value).toLowerCase();
const apiKey = clean($env.INSTANTLY_API_KEY_YOLANDA);
if (!apiKey) throw new Error('Missing Easypanel environment variable INSTANTLY_API_KEY_YOLANDA');

const eligible = rows.filter((row) => clean(row.email) && lower(row.email_verification_status) === 'valid' && !clean(row.platform_lead_id) && ['ready_to_send', 'retry_instantly'].includes(lower(row.outreach_status)));
const output = [];
for (const row of eligible.slice(0, cfg.batch_limit)) {
  const rowNumber = Number(row.row_number || row.__row_number || row._rowNumber);
  if (!rowNumber) continue;
  const now = new Date().toISOString();
  try {
    const response = await fetch('https://api.instantly.ai/api/v2/leads', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        campaign: cfg.platform_campaign_id,
        email: lower(row.email),
        company_name: clean(row.company_name),
        website: clean(row.website),
        phone: clean(row.telefono),
        payload: {
          campaign_key: cfg.campaign_key,
          city: clean(row.city),
          target_type: clean(row.target_type),
          sector: clean(row.sector),
          offer_type: clean(row.offer_type),
          landing_url: clean(row.landing_url),
          pain_hypothesis: clean(row.pain_hypothesis),
          language: clean(row.language) || 'es',
          sender_profile: clean(row.sender_profile),
        },
        skip_if_in_workspace: true,
        skip_if_in_campaign: true,
        skip_if_in_list: true,
      }),
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error('Instantly ' + response.status + ': ' + raw.slice(0, 300)), { fatal: true });
    if (!response.ok) {
      const duplicate = /already|exist|duplicate/i.test(raw);
      output.push({ json: {
        row_number: rowNumber,
        platform: 'instantly',
        platform_campaign_id: cfg.platform_campaign_id,
        platform_lead_id: duplicate ? 'existing:' + lower(row.email) : '',
        platform_status: duplicate ? 'already_exists' : 'error',
        platform_last_event: now,
        outreach_status: duplicate ? 'already_in_instantly' : 'instantly_error',
        _sheet_name: cfg.sheet_name,
        write_row: true,
      } });
      continue;
    }
    const leadId = clean(data.id || data.lead_id || data.lead?.id);
    output.push({ json: {
      row_number: rowNumber,
      platform: 'instantly',
      platform_campaign_id: cfg.platform_campaign_id,
      platform_lead_id: leadId || 'accepted:' + lower(row.email),
      platform_status: 'queued',
      platform_last_event: now,
      outreach_status: 'queued_instantly',
      _sheet_name: cfg.sheet_name,
      write_row: true,
    } });
  } catch (error) {
    if (error.fatal) throw error;
    output.push({ json: { row_number: rowNumber, platform: 'instantly', platform_campaign_id: cfg.platform_campaign_id, platform_lead_id: '', platform_status: 'error', platform_last_event: now, outreach_status: 'instantly_error', _sheet_name: cfg.sheet_name, write_row: true } });
  }
}

return output.length ? output : [{ json: { _sheet_name: cfg.sheet_name, write_row: false, reason: 'No verified leads ready for Instantly' } }];
`;

const NORMALIZE_EVENT_CODE = String.raw`
const deploy = $('SET — CONFIG').first().json;
const secret = String($env.INSTANTLY_WEBHOOK_SECRET_YOLANDA ?? '').trim();
if (!secret) throw new Error('Missing Easypanel environment variable INSTANTLY_WEBHOOK_SECRET_YOLANDA');
const headers = deploy.headers || {};
const receivedSecret = String(headers['x-yolanda-webhook-secret'] ?? headers['X-Yolanda-Webhook-Secret'] ?? '').trim();
if (receivedSecret !== secret) throw new Error('Invalid Instantly webhook secret');

const payload = deploy.body && typeof deploy.body === 'object' ? deploy.body : deploy;
const clean = (value) => String(value ?? '').trim();
const campaignId = clean(payload.campaign_id || payload.campaignId || payload.campaign);
const eventType = clean(payload.event_type || payload.eventType || payload.type).toLowerCase();
const email = clean(payload.lead_email || payload.email || payload.lead?.email).toLowerCase();
const configs = $input.all().map((item) => item.json || {});
const cfg = configs.find((row) => clean(row.platform_campaign_id) === campaignId);
if (!cfg || !email || !eventType) {
  return [{ json: { write_row: false, reason: 'Unknown campaign, email, or event type', campaign_id: campaignId, event_type: eventType, email } }];
}

return [{ json: {
  write_row: true,
  _sheet_name: clean(cfg.sheet_name),
  campaign_key: clean(cfg.campaign_key),
  client_name: clean(cfg.client_name),
  email,
  event_type: eventType,
  event_at: clean(payload.timestamp || payload.created_at || payload.event_at) || new Date().toISOString(),
  first_name: clean(payload.first_name || payload.lead?.first_name),
  last_name: clean(payload.last_name || payload.lead?.last_name),
  company_name: clean(payload.company_name || payload.lead?.company_name),
} }];
`;

const APPLY_EVENT_CODE = String.raw`
const event = $('Normalize event').first().json;
const deploy = $('SET — CONFIG').first().json;
const rows = $input.all().map((item) => item.json || {});
const clean = (value) => String(value ?? '').trim();
const lower = (value) => clean(value).toLowerCase();
const row = rows.find((candidate) => lower(candidate.email) === lower(event.email));
if (!row) return [{ json: { write_row: false, reason: 'Lead email not found in client sheet', email: event.email } }];

const sentEvents = new Set(['email_sent']);
const replyEvents = new Set(['reply_received', 'lead_neutral', 'lead_interested', 'lead_not_interested', 'lead_out_of_office', 'lead_wrong_person']);
const ghlEvents = new Set(['reply_received', 'lead_interested', 'lead_meeting_booked', 'lead_meeting_completed', 'lead_closed']);
const blockedEvents = new Set(['email_bounced', 'lead_unsubscribed']);

let outreachStatus = clean(row.outreach_status);
let leadStatus = clean(row.lead_status);
let replyStatus = clean(row.reply_status);
let lastContactDate = clean(row.last_contact_date);
let ghlContactId = clean(row.ghl_contact_id);

if (sentEvents.has(event.event_type)) {
  outreachStatus = 'sent';
  lastContactDate = event.event_at;
}
if (replyEvents.has(event.event_type)) {
  outreachStatus = 'replied';
  replyStatus = event.event_type;
  leadStatus = event.event_type === 'lead_interested' ? 'interested' : event.event_type === 'lead_not_interested' ? 'not_interested' : 'replied';
  lastContactDate = event.event_at;
}
if (event.event_type === 'lead_meeting_booked') {
  outreachStatus = 'meeting_booked';
  replyStatus = 'meeting_booked';
  leadStatus = 'meeting_booked';
}
if (event.event_type === 'lead_closed') leadStatus = 'closed';
if (blockedEvents.has(event.event_type)) {
  outreachStatus = 'stopped';
  leadStatus = event.event_type === 'email_bounced' ? 'bounced' : 'unsubscribed';
}

if (ghlEvents.has(event.event_type)) {
  const token = clean($env.GHL_PRIVATE_INTEGRATION_TOKEN_YOLANDA);
  const locationId = clean(deploy.GHL_LOCATION_ID_YOLANDA);
  if (!token) throw new Error('Missing Easypanel environment variable GHL_PRIVATE_INTEGRATION_TOKEN_YOLANDA');
  if (!locationId || locationId.startsWith('REPLACE_')) throw new Error('Missing GHL_LOCATION_ID_YOLANDA in SET — CONFIG');
  const response = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + token, version: '2021-04-15' },
    body: JSON.stringify({
      locationId,
      email: event.email,
      firstName: event.first_name || undefined,
      lastName: event.last_name || undefined,
      companyName: event.company_name || clean(row.company_name) || event.client_name,
      tags: ['yolanda-outbound', event.campaign_key, event.event_type],
    }),
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) throw new Error('GHL ' + response.status + ': ' + raw.slice(0, 300));
  ghlContactId = clean(data.contact?.id || data.id || ghlContactId);
}

return [{ json: {
  email: event.email,
  platform_status: event.event_type,
  platform_last_event: event.event_at,
  outreach_status: outreachStatus,
  last_contact_date: lastContactDate,
  lead_status: leadStatus,
  reply_status: replyStatus,
  ghl_contact_id: ghlContactId,
  _sheet_name: event._sheet_name,
  write_row: true,
} }];
`;

function makeCampaignLoopWorkflow({ name, scheduleMinutes, configAssignments, filterCode, readName, processName, processCode, writeName, writeOperation, writeFields, matchField }) {
  const nodes = [
    manual(name, [-1080, 120]),
    schedule(name, scheduleMinutes, [-1080, 280]),
    editFields(name, configAssignments, [-840, 200]),
    sheetRead(name, 'Read CONFIG_CAMPAIGNS', "={{ $('SET — CONFIG').first().json.CONFIG_SHEET_NAME }}", [-600, 200]),
    code(name, 'Select campaigns', filterCode, [-360, 200]),
    loop(name, [-120, 200]),
    sheetRead(name, readName, "={{ $('Loop campaigns').first().json.sheet_name }}", [120, 320]),
    code(name, processName, processCode, [360, 320]),
    ifBoolean(name, 'Has rows to write?', '={{ $json.write_row === true }}', [600, 320]),
    sheetWrite(name, writeName, writeOperation, '={{ $json._sheet_name }}', writeFields, matchField, [840, 240]),
    noop(name, 'No rows', [840, 400]),
    noop(name, 'Done', [120, 80]),
  ];
  const connections = {};
  connect(connections, 'Manual Trigger', 0, 'SET — CONFIG');
  connect(connections, 'Schedule Trigger', 0, 'SET — CONFIG');
  connect(connections, 'SET — CONFIG', 0, 'Read CONFIG_CAMPAIGNS');
  connect(connections, 'Read CONFIG_CAMPAIGNS', 0, 'Select campaigns');
  connect(connections, 'Select campaigns', 0, 'Loop campaigns');
  connect(connections, 'Loop campaigns', 0, 'Done');
  connect(connections, 'Loop campaigns', 1, readName);
  connect(connections, readName, 0, processName);
  connect(connections, processName, 0, 'Has rows to write?');
  connect(connections, 'Has rows to write?', 0, writeName);
  connect(connections, 'Has rows to write?', 1, 'No rows');
  connect(connections, writeName, 0, 'Loop campaigns');
  connect(connections, 'No rows', 0, 'Loop campaigns');
  return baseWorkflow(name, nodes, connections);
}

const commonSet = { GOOGLE_SHEET_ID: SHEET_ID, CONFIG_SHEET_NAME: CONFIG_TAB };

const workflows = [];

workflows.push(makeCampaignLoopWorkflow({
  name: 'YOLANDA — 01 — Import Apify datasets',
  scheduleMinutes: 30,
  configAssignments: {
    ...commonSet,
    APIFY_DATASET_ID_MITICA: 'REPLACE_WITH_MITICA_DATASET_ID',
    APIFY_DATASET_ID_NOMAD: 'REPLACE_WITH_NOMAD_DATASET_ID',
  },
  filterCode: COMMON_CONFIG_FILTER.replace(".map((row) => ({", ".filter((row) => text(row.source_type).toLowerCase() === 'apify')\n  .map((row) => ({"),
  readName: 'Read client sheet',
  processName: 'Import and normalize Apify',
  processCode: APIFY_IMPORT_CODE,
  writeName: 'Append new leads',
  writeOperation: 'append',
  writeFields: CLIENT_COLUMNS.filter((field) => field !== 'id'),
  matchField: null,
}));

workflows.push(makeCampaignLoopWorkflow({
  name: 'YOLANDA — 02 — Enrich Apollo leads',
  scheduleMinutes: 30,
  configAssignments: commonSet,
  filterCode: COMMON_CONFIG_FILTER.replace(".map((row) => ({", ".filter((row) => text(row.source_type).toLowerCase() === 'apollo')\n  .map((row) => ({"),
  readName: 'Read client sheet',
  processName: 'Search and enrich Apollo',
  processCode: APOLLO_ENRICH_CODE,
  writeName: 'Update Apollo result',
  writeOperation: 'update',
  writeFields: ['row_number', 'email', 'telefono', 'email_verification_status', 'email_verification_provider', 'email_verified_at', 'outreach_status', 'lead_status'],
  matchField: 'row_number',
}));

workflows.push(makeCampaignLoopWorkflow({
  name: 'YOLANDA — 03 — Verify emails NeverBounce',
  scheduleMinutes: 10,
  configAssignments: commonSet,
  filterCode: COMMON_CONFIG_FILTER.replace(".map((row) => ({", ".filter((row) => truthy(row.requires_email_verification))\n  .map((row) => ({"),
  readName: 'Read client sheet',
  processName: 'Verify with NeverBounce',
  processCode: VERIFY_EMAIL_CODE,
  writeName: 'Update verification',
  writeOperation: 'update',
  writeFields: ['row_number', 'email_verification_status', 'email_verification_provider', 'email_verified_at', 'outreach_status', 'lead_status'],
  matchField: 'row_number',
}));

workflows.push(makeCampaignLoopWorkflow({
  name: 'YOLANDA — 04 — Push verified leads to Instantly',
  scheduleMinutes: 10,
  configAssignments: commonSet,
  filterCode: COMMON_CONFIG_FILTER.replace(".map((row) => ({", ".filter((row) => text(row.sending_platform).toLowerCase() === 'instantly' && text(row.platform_campaign_id) && !['pending', 'replace_me'].includes(text(row.platform_campaign_id).toLowerCase()))\n  .map((row) => ({"),
  readName: 'Read client sheet',
  processName: 'Create Instantly leads',
  processCode: PUSH_INSTANTLY_CODE,
  writeName: 'Update Instantly result',
  writeOperation: 'update',
  writeFields: ['row_number', 'platform', 'platform_campaign_id', 'platform_lead_id', 'platform_status', 'platform_last_event', 'outreach_status'],
  matchField: 'row_number',
}));

{
  const name = 'YOLANDA — 05 — Instantly events to Sheet and GHL';
  const nodes = [
    webhook(name, [-920, 200]),
    editFields(name, { ...commonSet, GHL_LOCATION_ID_YOLANDA: 'REPLACE_WITH_GHL_LOCATION_ID' }, [-680, 200], true),
    sheetRead(name, 'Read CONFIG_CAMPAIGNS', "={{ $('SET — CONFIG').first().json.CONFIG_SHEET_NAME }}", [-440, 200]),
    code(name, 'Normalize event', NORMALIZE_EVENT_CODE, [-200, 200]),
    ifBoolean(name, 'Known event?', '={{ $json.write_row === true }}', [40, 200]),
    sheetRead(name, 'Read target client sheet', "={{ $('Normalize event').first().json._sheet_name }}", [280, 120]),
    code(name, 'Apply event and sync GHL', APPLY_EVENT_CODE, [520, 120]),
    ifBoolean(name, 'Lead found?', '={{ $json.write_row === true }}', [760, 120]),
    sheetWrite(name, 'Update lead event', 'update', '={{ $json._sheet_name }}', ['email', 'platform_status', 'platform_last_event', 'outreach_status', 'last_contact_date', 'lead_status', 'reply_status', 'ghl_contact_id'], 'email', [1000, 40]),
    noop(name, 'Ignored event', [280, 300]),
    noop(name, 'Lead not found', [1000, 200]),
  ];
  const connections = {};
  connect(connections, 'Instantly Webhook', 0, 'SET — CONFIG');
  connect(connections, 'SET — CONFIG', 0, 'Read CONFIG_CAMPAIGNS');
  connect(connections, 'Read CONFIG_CAMPAIGNS', 0, 'Normalize event');
  connect(connections, 'Normalize event', 0, 'Known event?');
  connect(connections, 'Known event?', 0, 'Read target client sheet');
  connect(connections, 'Known event?', 1, 'Ignored event');
  connect(connections, 'Read target client sheet', 0, 'Apply event and sync GHL');
  connect(connections, 'Apply event and sync GHL', 0, 'Lead found?');
  connect(connections, 'Lead found?', 0, 'Update lead event');
  connect(connections, 'Lead found?', 1, 'Lead not found');
  workflows.push(baseWorkflow(name, nodes, connections));
}

const filenames = [
  '01_import_apify_datasets.json',
  '02_enrich_apollo_leads.json',
  '03_verify_emails_neverbounce.json',
  '04_push_verified_leads_to_instantly.json',
  '05_instantly_events_to_sheet_ghl.json',
];

for (let index = 0; index < workflows.length; index++) {
  fs.writeFileSync(path.join(OUT_DIR, filenames[index]), JSON.stringify(workflows[index], null, 2) + '\n', 'utf8');
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  google_sheet_id: SHEET_ID,
  config_sheet: CONFIG_TAB,
  workflows: filenames,
  future_error_workflow: '99 — reserved; not generated',
}, null, 2) + '\n', 'utf8');

console.log('Generated ' + workflows.length + ' disabled n8n workflows in ' + OUT_DIR);
