import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const LEAD_HEADERS = [
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

const STATUS_VALUES = [
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

const CONFIG_ROWS = [
  ["KEY", "VALUE", "DESCRIPTION"],
  ["APOLLO_ENABLED", "true", "Activa o desactiva Apollo"],
  ["BATCH_SIZE", "10", "Files processades per execucio"],
  ["MAX_CANDIDATES_PER_COMPANY", "10", "Candidats maxims retornats"],
  ["OVERWRITE_EXISTING_CONTACT_DATA", "false", "Permet sobreescriure dades manuals"],
  ["RECHECK_AFTER_DAYS", "90", "Dies abans de tornar a consultar"],
  ["COUNTRY_DEFAULT", "Spain", "Pais per defecte"],
  ["APOLLO_API_KEY_ENV_VAR", "APOLLO_API_KEY", "Variable d'entorn segura"],
  ["WORKFLOW_VERSION", "1.0.0", "Versio del workflow"],
];

const SCHEMA = [
  {
    id: "row_number",
    displayName: "row_number",
    required: false,
    defaultMatch: true,
    display: true,
    type: "number",
    canBeUsedToMatch: true,
  },
  ...LEAD_HEADERS.map((header) => ({
    id: header,
    displayName: header,
    required: false,
    defaultMatch: header === "lead_id",
    display: true,
    type: header === "apollo_attempts" ? "number" : "string",
    canBeUsedToMatch: header === "lead_id",
  })),
];

const PARSE_CONFIG_CODE = String.raw`
const defaults = $('Configuracio base').first().json;
const rawRows = $input.all().map((item) => item.json || {});
const values = {};

for (const row of rawRows) {
  const key = String(row.KEY ?? row.key ?? '').trim();
  if (!key || key.toUpperCase() === 'KEY') continue;
  values[key.toUpperCase()] = row.VALUE ?? row.value ?? '';
}

const readBool = (key, fallback) => {
  const value = values[key] ?? fallback;
  return String(value).trim().toLowerCase() === 'true';
};
const readInt = (key, fallback, min, max) => {
  const parsed = Math.floor(Number(values[key] ?? fallback));
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, safe));
};

return [{
  json: {
    ...defaults,
    apollo_enabled: readBool('APOLLO_ENABLED', true),
    batch_size: readInt('BATCH_SIZE', 10, 1, 100),
    max_candidates_per_company: readInt('MAX_CANDIDATES_PER_COMPANY', 10, 1, 100),
    overwrite_existing_contact_data: readBool('OVERWRITE_EXISTING_CONTACT_DATA', false),
    recheck_after_days: readInt('RECHECK_AFTER_DAYS', 90, 1, 3650),
    country_default: String(values.COUNTRY_DEFAULT || 'Spain').trim() || 'Spain',
    apollo_api_key_env_var: String(values.APOLLO_API_KEY_ENV_VAR || 'APOLLO_API_KEY').trim() || 'APOLLO_API_KEY',
    workflow_version: String(values.WORKFLOW_VERSION || defaults.workflow_version || '1.0.0').trim(),
  },
}];
`;

const PREPARE_QUEUE_CODE = String.raw`
const cfg = $('Normalitzar CONFIG').first().json;
const rows = $input.all();
const now = new Date();
const emptyStatuses = new Set(['', 'pending', 'retry']);
const neverRepeat = new Set(['matched', 'completed']);

const clean = (value) => String(value ?? '').trim();
const hasLeadInput = (row) => [
  'company_name',
  'company_domain',
  'company_website',
  'company_city',
].some((key) => clean(row[key]));

const isStale = (value) => {
  const raw = clean(value);
  if (!raw) return false;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;
  const ageMs = now.getTime() - parsed.getTime();
  return ageMs > Number(cfg.recheck_after_days) * 24 * 60 * 60 * 1000;
};

const out = [];
let skipped = 0;
let blank = 0;

for (let index = 0; index < rows.length; index++) {
  const row = rows[index].json || {};
  if (!hasLeadInput(row)) {
    blank++;
    continue;
  }

  const status = clean(row.apollo_status).toLowerCase();
  const due = emptyStatuses.has(status) || (!neverRepeat.has(status) && isStale(row.apollo_last_checked_at));
  if (!due) {
    skipped++;
    continue;
  }

  out.push({
    json: {
      ...row,
      row_number: index + 2,
      workflow_version: cfg.workflow_version,
      config: cfg,
    },
  });

  if (out.length >= Number(cfg.batch_size)) break;
}

if (!out.length) {
  return [{
    json: {
      summary_only: true,
      total_rows: rows.length,
      processed: 0,
      matched: 0,
      matched_without_email: 0,
      no_person_found: 0,
      insufficient_company_data: 0,
      api_errors: 0,
      rate_limited: 0,
      credit_exhausted: 0,
      skipped,
      blank,
      execution_started_at: now.toISOString(),
      execution_finished_at: new Date().toISOString(),
      workflow_version: cfg.workflow_version,
    },
  }];
}

return out;
`;

const APOLLO_CODE = String.raw`
const SEARCH_URL = 'https://api.apollo.io/api/v1/mixed_people/api_search';
const ENRICH_URL = 'https://api.apollo.io/api/v1/people/match';
const REQUEST_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;

const TITLE_RULES = [
  { label: 'Owner', score: 100, pattern: /\b(owner|propietari|dueno|duena)\b/i },
  { label: 'Founder', score: 95, pattern: /\b(co[-\s]?founder|founder|fundador|fundadora)\b/i },
  { label: 'CEO', score: 90, pattern: /\b(ceo|chief executive officer|director general)\b/i },
  { label: 'Managing Director', score: 85, pattern: /\b(managing director|director gerente|director ejecutivo)\b/i },
  { label: 'General Manager', score: 80, pattern: /\b(general manager|gerente general)\b/i },
  { label: 'Partner', score: 78, pattern: /\b(partner|socio|socia)\b/i },
  { label: 'COO / Operations Director', score: 75, pattern: /\b(coo|chief operating officer|operations director|director of operations|director de operaciones|operacions)\b/i },
  { label: 'Commercial / Sales Director', score: 70, pattern: /\b(commercial director|sales director|director comercial|director de ventas|head of sales)\b/i },
  { label: 'Marketing Director', score: 65, pattern: /\b(marketing director|director de marketing|head of marketing)\b/i },
  { label: 'Head of Operations', score: 58, pattern: /\b(head of operations|operations head|responsable de operaciones)\b/i },
  { label: 'Head of Sales', score: 56, pattern: /\b(head of sales|sales head|responsable de ventas)\b/i },
  { label: 'Head of Marketing', score: 54, pattern: /\b(head of marketing|marketing head|responsable de marketing)\b/i },
  { label: 'Director', score: 50, pattern: /\b(director|directora)\b/i },
  { label: 'Head', score: 45, pattern: /\b(head|responsable)\b/i },
  { label: 'Manager', score: 40, pattern: /\b(manager|gerente|responsable)\b/i },
];

const SENIORITY_SCORE = {
  owner: 8,
  founder: 7,
  c_suite: 6,
  partner: 5,
  vp: 4,
  director: 3,
  head: 2,
  manager: 1,
};

const SEARCH_TITLES = [
  'Owner',
  'Founder',
  'Co-Founder',
  'CEO',
  'Managing Director',
  'General Manager',
  'Partner',
  'COO',
  'Operations Director',
  'Commercial Director',
  'Sales Director',
  'Marketing Director',
  'Head of Operations',
  'Head of Sales',
  'Head of Marketing',
  'Director',
  'Head',
  'Manager',
];

const SEARCH_SENIORITIES = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'director', 'head', 'manager'];
const EXCLUDED_TITLE = /\b(intern|student|assistant|trainee|junior|becario|becaria|practicas)\b/i;
const RECRUITER = /\b(recruiter|talent acquisition|reclutador|seleccion)\b/i;
const HR_SECTOR = /\b(hr|human resources|recursos humanos|seleccion|recruitment|talent)\b/i;
const ALLOWED_FUNCTION = /\b(owner|founder|ceo|chief|managing|general manager|partner|coo|operations|commercial|sales|marketing|director|head|manager|procurement|purchasing|buyer|compras|ventas|operaciones|direccion)\b/i;

const clean = (value) => String(value ?? '').trim();
const lower = (value) => clean(value).toLowerCase();
const isFilled = (value) => clean(value) !== '';
const toBool = (value) => String(value).trim().toLowerCase() === 'true';
const parseAttempts = (value) => Math.max(0, Math.floor(Number(value) || 0));

function normalizeDomain(value) {
  let text = lower(value);
  if (!text) return '';
  text = text.replace(/^https?:\/\//, '');
  text = text.replace(/^www\./, '');
  text = text.split(/[/?#]/)[0];
  text = text.replace(/\.+$/, '').replace(/\/+$/, '');
  if (!text.includes('.') || /\s/.test(text)) return '';
  return text;
}

function normalizeCompanyName(value) {
  return clean(value).replace(/\s+/g, ' ');
}

function hash53(text, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).toUpperCase();
}

function titleScore(title) {
  for (const rule of TITLE_RULES) {
    if (rule.pattern.test(clean(title))) return rule;
  }
  return { label: '', score: 0 };
}

function getSeniority(candidate) {
  const value = lower(candidate.seniority || candidate.person_seniority || candidate.seniority_level || '');
  if (value) return value;
  const match = titleScore(candidate.title || candidate.job_title || '').label.toLowerCase();
  if (match.includes('owner')) return 'owner';
  if (match.includes('founder')) return 'founder';
  if (match.includes('ceo')) return 'c_suite';
  if (match.includes('partner')) return 'partner';
  if (match.includes('director')) return 'director';
  if (match.includes('head')) return 'head';
  if (match.includes('manager')) return 'manager';
  return '';
}

function candidateName(candidate) {
  return clean(candidate.name) || [candidate.first_name, candidate.last_name || candidate.last_name_obfuscated].map(clean).filter(Boolean).join(' ');
}

function shouldExclude(candidate, sector) {
  const title = clean(candidate.title || candidate.job_title || '');
  if (!title) return true;
  if (EXCLUDED_TITLE.test(title)) return true;
  if (RECRUITER.test(title) && !HR_SECTOR.test(sector)) return true;
  if (!ALLOWED_FUNCTION.test(title)) return true;
  return false;
}

function organizationName(candidate) {
  return clean(candidate.organization?.name || candidate.organization_name || candidate.account?.name || '');
}

function organizationDomain(candidate) {
  return normalizeDomain(candidate.organization?.primary_domain || candidate.organization?.website_url || candidate.organization?.domain || candidate.domain || '');
}

function domainMatches(candidate, domain) {
  const orgDomain = organizationDomain(candidate);
  return Boolean(domain && orgDomain && orgDomain === domain);
}

function scoreCandidate(candidate, context, originalIndex) {
  const title = clean(candidate.title || candidate.job_title || '');
  if (shouldExclude({ ...candidate, title }, context.company_sector)) return null;
  const titleHit = titleScore(title);
  if (!titleHit.score) return null;
  const seniority = getSeniority(candidate);
  const seniorityRank = SENIORITY_SCORE[seniority] || 0;
  const emailStatus = lower(candidate.email_status || candidate.contact_email_status || '');
  const hasVerifiedEmail = emailStatus === 'verified' || candidate.has_email === true;
  const current = candidate.current !== false;
  const domainMatch = domainMatches(candidate, context.normalized_domain);
  const orgName = organizationName(candidate).toLowerCase();
  const companyName = lower(context.normalized_company_name);
  const companyMatch = companyName && orgName && (orgName.includes(companyName) || companyName.includes(orgName));

  if (!domainMatch && context.normalized_domain) {
    const orgDomain = organizationDomain(candidate);
    if (orgDomain && orgDomain !== context.normalized_domain) return null;
  }

  const score = titleHit.score
    + seniorityRank
    + (hasVerifiedEmail ? 3 : 0)
    + (current ? 2 : 0)
    + (domainMatch ? 2 : 0)
    + (companyMatch ? 1 : 0);

  return {
    candidate,
    score,
    titleScore: titleHit.score,
    titleLabel: titleHit.label,
    seniority,
    seniorityRank,
    hasVerifiedEmail,
    current,
    domainMatch,
    originalIndex,
  };
}

function chooseBestCandidate(candidates, context) {
  const scored = candidates
    .map((candidate, index) => scoreCandidate(candidate, context, index))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.seniorityRank !== a.seniorityRank) return b.seniorityRank - a.seniorityRank;
      if (Number(b.hasVerifiedEmail) !== Number(a.hasVerifiedEmail)) return Number(b.hasVerifiedEmail) - Number(a.hasVerifiedEmail);
      if (Number(b.current) !== Number(a.current)) return Number(b.current) - Number(a.current);
      if (Number(b.domainMatch) !== Number(a.domainMatch)) return Number(b.domainMatch) - Number(a.domainMatch);
      return a.originalIndex - b.originalIndex;
    });
  return scored[0] || null;
}

function minimumCompanyData(row, countryDefault) {
  const domain = normalizeDomain(row.company_domain) || normalizeDomain(row.company_website);
  const companyName = normalizeCompanyName(row.company_name);
  const city = clean(row.company_city);
  const country = clean(row.company_country) || countryDefault;
  if (domain) return { ok: true, mode: 'domain', domain, companyName, city, country };
  if (companyName && city) return { ok: true, mode: 'name_city', domain: '', companyName, city, country };
  return { ok: false, mode: 'insufficient', domain: '', companyName, city, country };
}

function preserve(row, key, value, overwrite) {
  const existing = clean(row[key]);
  if (!overwrite && existing) return existing;
  return clean(value);
}

function responseText(body) {
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body || {});
  } catch {
    return '';
  }
}

function classifyApiError(status, body, timedOut) {
  const text = responseText(body).toLowerCase();
  if (timedOut) return { status: 'api_error', error: 'timeout' };
  if (/credit|credits|balance|quota|limit exceeded|exhaust/i.test(text) && status !== 429) {
    return { status: 'credit_exhausted', error: 'apollo credits or balance exhausted' };
  }
  if (status === 429) return { status: 'rate_limited', error: 'apollo rate limited' };
  if (status === 400) return { status: 'api_error', error: '400 invalid Apollo request' };
  if (status === 401 || status === 403) return { status: 'api_error', error: String(status) + ' Apollo credentials, master key, or endpoint scope issue' };
  if (status === 404) return { status: 'api_error', error: '404 Apollo endpoint or resource not found' };
  if (status === 409) return { status: 'api_error', error: '409 Apollo conflict' };
  if (status === 422) return { status: 'api_error', error: '422 Apollo validation error' };
  if (status >= 500) return { status: 'api_error', error: String(status) + ' temporary Apollo server error' };
  return { status: 'api_error', error: String(status || 'unknown') + ' Apollo API error' };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function apolloRequest(url, apiKey) {
  let last = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        signal: controller.signal,
      });
      const text = await res.text();
      let body = text;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {}
      last = { ok: res.ok, status: res.status, headers: res.headers, body, attempts: attempt + 1 };
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) return last;
      const retryAfter = Number(res.headers?.get?.('retry-after'));
      const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) : Math.min(2 ** attempt * 5, 30);
      await sleep(waitSeconds * 1000);
    } catch (error) {
      last = { ok: false, status: 0, body: { message: error.message }, attempts: attempt + 1, timedOut: error.name === 'AbortError' };
      if (attempt === MAX_RETRIES) return last;
      await sleep(Math.min(2 ** attempt * 5, 30) * 1000);
    } finally {
      clearTimeout(timeout);
    }
  }
  return last;
}

function buildSearchUrl(context, maxCandidates) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('page', '1');
  url.searchParams.set('per_page', String(maxCandidates));
  url.searchParams.set('include_similar_titles', 'false');
  for (const title of SEARCH_TITLES) url.searchParams.append('person_titles[]', title);
  for (const seniority of SEARCH_SENIORITIES) url.searchParams.append('person_seniorities[]', seniority);
  if (context.normalized_domain) {
    url.searchParams.append('q_organization_domains_list[]', context.normalized_domain);
  } else {
    url.searchParams.set('q_keywords', context.normalized_company_name);
    const location = [context.company_city, context.company_country].map(clean).filter(Boolean).join(', ');
    if (location) url.searchParams.append('organization_locations[]', location);
  }
  return url.toString();
}

function buildEnrichUrl(best, context) {
  const candidate = best.candidate;
  const url = new URL(ENRICH_URL);
  const personId = clean(candidate.id || candidate.person_id);
  if (personId) url.searchParams.set('id', personId);
  const name = candidateName(candidate);
  if (!personId && name) url.searchParams.set('name', name);
  if (context.normalized_domain) url.searchParams.set('domain', context.normalized_domain);
  if (!context.normalized_domain && context.normalized_company_name) url.searchParams.set('organization_name', context.normalized_company_name);
  const linkedin = clean(candidate.linkedin_url || candidate.linkedinUrl);
  if (!personId && linkedin) url.searchParams.set('linkedin_url', linkedin);
  url.searchParams.set('reveal_personal_emails', 'false');
  url.searchParams.set('reveal_phone_number', 'false');
  return url.toString();
}

function currentEmploymentMatches(person, context) {
  const history = Array.isArray(person.employment_history) ? person.employment_history : [];
  const current = history.find((entry) => entry && entry.current === true);
  if (!current) return true;
  const orgId = clean(current.organization_id);
  const personOrgId = clean(person.organization_id);
  if (orgId && personOrgId && orgId === personOrgId) return true;
  const orgName = lower(current.organization_name);
  const companyName = lower(context.normalized_company_name);
  if (companyName && orgName && (orgName.includes(companyName) || companyName.includes(orgName))) return true;
  return !context.normalized_company_name;
}

function outputBase(row, status, error, attempts, nowIso) {
  return {
    ...row,
    apollo_status: status,
    apollo_error: error || '',
    apollo_attempts: parseAttempts(row.apollo_attempts) + attempts,
    apollo_last_checked_at: nowIso,
    processed_at: nowIso,
  };
}

function outputContact(row, best, person, context, attempts, nowIso, overwrite) {
  const candidate = best.candidate;
  const source = person || candidate;
  const contact = source.contact || {};
  const email = clean(source.email || contact.email || row.decision_maker_email);
  const emailStatus = clean(source.email_status || contact.email_status || source.email_true_status || candidate.email_status);
  const phone = clean(source.sanitized_phone || contact.sanitized_phone || source.phone || contact.phone);
  const name = clean(source.name) || candidateName(candidate);
  const firstName = clean(source.first_name || candidate.first_name);
  const lastName = clean(source.last_name || candidate.last_name);
  const title = clean(source.title || candidate.title);
  const seniority = clean(source.seniority || best.seniority);
  const departments = Array.isArray(source.departments) ? source.departments.join(', ') : clean(source.department || source.departments);
  const status = email ? 'matched' : 'matched_without_email';

  return {
    ...row,
    lead_id: clean(row.lead_id) || 'APOLLO-' + hash53([context.normalized_domain, context.normalized_company_name, context.company_city].join('|')),
    decision_maker_name: preserve(row, 'decision_maker_name', name, overwrite),
    decision_maker_first_name: preserve(row, 'decision_maker_first_name', firstName, overwrite),
    decision_maker_last_name: preserve(row, 'decision_maker_last_name', lastName, overwrite),
    decision_maker_job_title: preserve(row, 'decision_maker_job_title', title, overwrite),
    decision_maker_seniority: preserve(row, 'decision_maker_seniority', seniority, overwrite),
    decision_maker_department: preserve(row, 'decision_maker_department', departments, overwrite),
    decision_maker_email: preserve(row, 'decision_maker_email', email, overwrite),
    decision_maker_email_status: preserve(row, 'decision_maker_email_status', emailStatus, overwrite),
    decision_maker_phone: preserve(row, 'decision_maker_phone', phone, overwrite),
    decision_maker_linkedin_url: preserve(row, 'decision_maker_linkedin_url', source.linkedin_url || candidate.linkedin_url, overwrite),
    apollo_person_id: preserve(row, 'apollo_person_id', source.id || candidate.id || source.person_id || candidate.person_id, overwrite),
    apollo_organization_id: preserve(row, 'apollo_organization_id', source.organization_id || candidate.organization_id || source.organization?.id || candidate.organization?.id, overwrite),
    apollo_status: status,
    apollo_error: '',
    apollo_attempts: parseAttempts(row.apollo_attempts) + attempts,
    apollo_last_checked_at: nowIso,
    processed_at: nowIso,
  };
}

async function processRow(row) {
  const cfg = row.config || {};
  const nowIso = new Date().toISOString();
  const overwrite = toBool(cfg.overwrite_existing_contact_data);
  const company = minimumCompanyData(row, cfg.country_default || 'Spain');
  const context = {
    normalized_domain: company.domain,
    normalized_company_name: company.companyName,
    company_city: company.city,
    company_country: company.country,
    company_sector: clean(row.company_sector),
  };

  if (!company.ok) {
    return outputBase(row, 'insufficient_company_data', 'Need company_domain, company_website, or company_name + company_city', 0, nowIso);
  }
  if (!toBool(cfg.apollo_enabled)) {
    return outputBase(row, 'skipped', 'APOLLO_ENABLED is false', 0, nowIso);
  }

  const apiKeyName = clean(cfg.apollo_api_key_env_var || 'APOLLO_API_KEY');
  const apiKey = $env[apiKeyName];
  if (!apiKey) {
    return outputBase(row, 'api_error', apiKeyName + ' is not configured in n8n/EasyPanel environment', 0, nowIso);
  }

  const search = await apolloRequest(buildSearchUrl(context, Number(cfg.max_candidates_per_company) || 10), apiKey);
  if (!search.ok) {
    const classified = classifyApiError(search.status, search.body, search.timedOut);
    return outputBase(row, classified.status, classified.error, search.attempts || 1, nowIso);
  }

  const people = Array.isArray(search.body?.people) ? search.body.people : [];
  const best = chooseBestCandidate(people, context);
  if (!best) {
    return outputBase(row, 'no_person_found', 'No decision-maker candidate matched deterministic rules', search.attempts || 1, nowIso);
  }

  const alreadyHasEmail = isFilled(row.decision_maker_email) && !overwrite;
  const alreadyHasPersonId = isFilled(row.apollo_person_id);
  if (alreadyHasEmail || alreadyHasPersonId) {
    return outputContact(row, best, best.candidate, context, search.attempts || 1, nowIso, overwrite);
  }

  const enrich = await apolloRequest(buildEnrichUrl(best, context), apiKey);
  const attempts = (search.attempts || 1) + (enrich.attempts || 1);
  if (!enrich.ok) {
    const classified = classifyApiError(enrich.status, enrich.body, enrich.timedOut);
    return outputBase(row, classified.status, classified.error, attempts, nowIso);
  }

  const person = enrich.body?.person || enrich.body?.contact || {};
  if (!currentEmploymentMatches(person, context)) {
    return outputBase(row, 'no_person_found', 'Best enriched person is not currently matched to this company', attempts, nowIso);
  }

  return outputContact(row, best, person, context, attempts, nowIso, overwrite);
}

return await (async () => {
  const inputRows = $input.all().map((item) => item.json || {});
  const output = [];
  for (const row of inputRows) {
    output.push({ json: await processRow(row) });
  }
  return output;
})();
`;

const SUMMARY_CODE = String.raw`
const items = $input.all().map((item) => item.json || {});

if (items.length === 1 && items[0].summary_only) {
  return [{ json: items[0] }];
}

const started = items
  .map((item) => item.apollo_last_checked_at || item.processed_at)
  .filter(Boolean)
  .sort()[0] || new Date().toISOString();

const count = (status) => items.filter((item) => item.apollo_status === status).length;
const summary = {
  total_rows: $('Llegir LEADS').all().length,
  processed: items.length,
  matched: count('matched'),
  matched_without_email: count('matched_without_email'),
  no_person_found: count('no_person_found'),
  insufficient_company_data: count('insufficient_company_data'),
  api_errors: count('api_error'),
  rate_limited: count('rate_limited'),
  credit_exhausted: count('credit_exhausted'),
  skipped: count('skipped'),
  execution_started_at: started,
  execution_finished_at: new Date().toISOString(),
  workflow_version: $('Normalitzar CONFIG').first().json.workflow_version,
};

return [{ json: summary }];
`;

const node = (id, name, type, typeVersion, position, parameters = {}, extra = {}) => ({
  parameters,
  id,
  name,
  type,
  typeVersion,
  position,
  ...extra,
});

const sheetLocator = (value) => ({ __rl: true, value, mode: "name" });
const docLocator = (value) => ({ __rl: true, value, mode: "id" });

const updateValues = Object.fromEntries(
  ["row_number", ...LEAD_HEADERS].map((header) => [header, "={{ $json['" + header + "'] }}"]),
);

const workflow = {
  name: "AImetos | Apollo decision maker enrichment",
  nodes: [
    node("apollo-manual", "Inici manual", "n8n-nodes-base.manualTrigger", 1, [-1260, 80]),
    node("apollo-base-config", "Configuracio base", "n8n-nodes-base.set", 3.4, [-1040, 80], {
      assignments: {
        assignments: [
          { id: "cfg-sheet", name: "google_sheet_id", value: "1JBuVbNMQTpk9BBxT8Lar6XFKSlzsvmqRw4cppbuRmjo", type: "string" },
          { id: "cfg-leads-tab", name: "leads_sheet_name", value: "LEADS", type: "string" },
          { id: "cfg-config-tab", name: "config_sheet_name", value: "CONFIG", type: "string" },
          { id: "cfg-version", name: "workflow_version", value: "1.0.0", type: "string" },
        ],
      },
      options: {},
    }),
    node("apollo-read-config", "Llegir CONFIG", "n8n-nodes-base.googleSheets", 4.7, [-820, 80], {
      operation: "read",
      documentId: docLocator("={{ $('Configuracio base').first().json.google_sheet_id }}"),
      sheetName: sheetLocator("={{ $('Configuracio base').first().json.config_sheet_name }}"),
      options: {},
    }, {
      credentials: {
        googleSheetsOAuth2Api: {
          id: "GOOGLE_SHEETS_CREDENTIALS",
          name: "GOOGLE_SHEETS_CREDENTIALS",
        },
      },
    }),
    node("apollo-normalize-config", "Normalitzar CONFIG", "n8n-nodes-base.code", 2, [-600, 80], {
      jsCode: PARSE_CONFIG_CODE,
    }),
    node("apollo-read-leads", "Llegir LEADS", "n8n-nodes-base.googleSheets", 4.7, [-380, 80], {
      operation: "read",
      documentId: docLocator("={{ $('Normalitzar CONFIG').first().json.google_sheet_id }}"),
      sheetName: sheetLocator("={{ $('Normalitzar CONFIG').first().json.leads_sheet_name }}"),
      options: {},
    }, {
      credentials: {
        googleSheetsOAuth2Api: {
          id: "GOOGLE_SHEETS_CREDENTIALS",
          name: "GOOGLE_SHEETS_CREDENTIALS",
        },
      },
    }),
    node("apollo-prepare-queue", "Preparar cues", "n8n-nodes-base.code", 2, [-160, 80], {
      jsCode: PREPARE_QUEUE_CODE,
    }),
    node("apollo-has-row", "Hi ha fila?", "n8n-nodes-base.if", 2.2, [60, 80], {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
        conditions: [
          {
            id: "has-row",
            leftValue: "={{ !$json.summary_only }}",
            rightValue: true,
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    }),
    node("apollo-search-enrich", "Apollo - buscar i enriquir", "n8n-nodes-base.code", 2, [300, -20], {
      jsCode: APOLLO_CODE,
    }),
    node("apollo-update-leads", "Google Sheets - actualitzar LEADS", "n8n-nodes-base.googleSheets", 4.7, [540, -20], {
      operation: "update",
      documentId: docLocator("={{ $('Normalitzar CONFIG').first().json.google_sheet_id }}"),
      sheetName: sheetLocator("={{ $('Normalitzar CONFIG').first().json.leads_sheet_name }}"),
      columns: {
        mappingMode: "defineBelow",
        value: updateValues,
        matchingColumns: ["row_number"],
        schema: SCHEMA,
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      options: {
        cellFormat: "USER_ENTERED",
        handlingExtraData: "ignoreIt",
      },
    }, {
      credentials: {
        googleSheetsOAuth2Api: {
          id: "GOOGLE_SHEETS_CREDENTIALS",
          name: "GOOGLE_SHEETS_CREDENTIALS",
        },
      },
    }),
    node("apollo-summary", "Resum final", "n8n-nodes-base.code", 2, [780, 80], {
      jsCode: SUMMARY_CODE,
    }),
  ],
  pinData: {},
  connections: {
    "Inici manual": { main: [[{ node: "Configuracio base", type: "main", index: 0 }]] },
    "Configuracio base": { main: [[{ node: "Llegir CONFIG", type: "main", index: 0 }]] },
    "Llegir CONFIG": { main: [[{ node: "Normalitzar CONFIG", type: "main", index: 0 }]] },
    "Normalitzar CONFIG": { main: [[{ node: "Llegir LEADS", type: "main", index: 0 }]] },
    "Llegir LEADS": { main: [[{ node: "Preparar cues", type: "main", index: 0 }]] },
    "Preparar cues": { main: [[{ node: "Hi ha fila?", type: "main", index: 0 }]] },
    "Hi ha fila?": {
      main: [
        [{ node: "Apollo - buscar i enriquir", type: "main", index: 0 }],
        [{ node: "Resum final", type: "main", index: 0 }],
      ],
    },
    "Apollo - buscar i enriquir": { main: [[{ node: "Google Sheets - actualitzar LEADS", type: "main", index: 0 }]] },
    "Google Sheets - actualitzar LEADS": { main: [[{ node: "Resum final", type: "main", index: 0 }]] },
  },
  active: false,
  settings: {
    executionOrder: "v1",
    timezone: "Europe/Madrid",
    saveManualExecutions: true,
  },
  versionId: "apollo-decision-maker-enrichment-1.0.0",
  meta: {
    templateCredsSetupCompleted: false,
    instanceId: "AIMETOS_APOLLO_PLACEHOLDER",
  },
  id: "AIMETOS_APOLLO_DECISION_MAKER_ENRICHMENT",
  tags: [],
};

const workflowDir = path.join(root, "workflows", "apollo");
const templateDir = path.join(root, "templates");
fs.mkdirSync(workflowDir, { recursive: true });
fs.mkdirSync(templateDir, { recursive: true });

fs.writeFileSync(
  path.join(workflowDir, "Apollo_Decision_Maker_Enrichment.json"),
  JSON.stringify(workflow, null, 2) + "\n",
);

const csv = (rows) => rows.map((row) => row.map((cell) => {
  const value = String(cell ?? "");
  return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}).join(",")).join("\n") + "\n";

fs.writeFileSync(
  path.join(templateDir, "Apollo_Lead_Enrichment_LEADS.csv"),
  csv([LEAD_HEADERS]),
);
fs.writeFileSync(
  path.join(templateDir, "Apollo_Lead_Enrichment_CONFIG.csv"),
  csv(CONFIG_ROWS),
);

console.log("Generated Apollo workflow and CSV templates.");
