const APIFY_ACTOR_ID = 'apify~google-search-scraper';
const APIFY_API_BASE = 'https://api.apify.com/v2';
const MAX_RETRIES = 2;

const clean = (value) => String(value ?? '').trim();
const lower = (value) => clean(value).toLowerCase();
const toBool = (value) => String(value).trim().toLowerCase() === 'true';
const parseAttempts = (value) => Math.max(0, Math.floor(Number(value) || 0));

const TITLE_RULES = [
  { label: 'Owner', score: 100, terms: ['owner', 'propietario', 'propietaria', 'dueño', 'dueña'] },
  { label: 'Founder', score: 95, terms: ['founder', 'co-founder', 'fundador', 'fundadora'] },
  { label: 'CEO', score: 90, terms: ['ceo', 'chief executive officer', 'director general'] },
  { label: 'Managing Director', score: 85, terms: ['managing director', 'director gerente', 'director ejecutivo'] },
  { label: 'General Manager', score: 80, terms: ['general manager', 'gerente general'] },
  { label: 'Partner', score: 78, terms: ['partner', 'socio', 'socia'] },
  { label: 'Operations Director', score: 75, terms: ['operations director', 'director de operaciones', 'coo'] },
  { label: 'Commercial Director', score: 70, terms: ['commercial director', 'sales director', 'director comercial', 'director de ventas'] },
  { label: 'Marketing Director', score: 65, terms: ['marketing director', 'director de marketing'] },
  { label: 'Director', score: 50, terms: ['director', 'directora'] },
  { label: 'Manager', score: 35, terms: ['manager', 'responsable', 'gerente'] },
];

const BAD_TITLE = /\b(job|jobs|empleo|trabajo|oferta|vacante|hiring|contratando|empresa|company|linkedin pulse|posts|activity|school|universidad)\b/i;
const LINKEDIN_PROFILE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+\/?/i;

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

function tokenForRow(row) {
  const leadId = clean(row.lead_id);
  const number = Number(leadId.replace(/\D/g, '')) || 1;
  const slot = ((number - 1) % 8) + 1;
  const envName = 'APIFY_TOKEN_CLIENT_' + String(slot).padStart(2, '0');
  const token = $env[envName];
  if (!token) {
    return {
      envName,
      token: '',
      error: envName + ' is not configured in n8n/EasyPanel environment',
    };
  }
  return { envName, token, error: '' };
}

function companyContext(row) {
  const companyName = clean(row.company_name);
  const website = clean(row.company_website || row.company_domain || row.source);
  const domain = normalizeDomain(row.company_domain) || normalizeDomain(website);
  const city = clean(row.company_city);
  const country = clean(row.company_country || row.config?.country_default || 'Spain');
  const sector = clean(row.company_sector);
  return { companyName, website, domain, city, country, sector };
}

function buildQueries(ctx) {
  const company = '"' + ctx.companyName + '"';
  const place = [ctx.city, ctx.country].filter(Boolean).join(' ');
  const roleGroupA = '("CEO" OR "Founder" OR "Owner" OR "Director General" OR "Managing Director")';
  const roleGroupB = '("Director Comercial" OR "Sales Director" OR "Operations Director" OR "Director de Operaciones")';
  const roleGroupC = '("General Manager" OR "Partner" OR "Socio" OR "Gerente")';
  const base = 'site:linkedin.com/in ' + company;

  const queries = [
    [base, roleGroupA, place].filter(Boolean).join(' '),
    [base, roleGroupB, place].filter(Boolean).join(' '),
    [base, roleGroupC, place].filter(Boolean).join(' '),
  ];

  if (ctx.domain) {
    queries.push(['site:linkedin.com/in', '"' + ctx.domain + '"', roleGroupA].join(' '));
  }

  return queries;
}

function apifyInputForQueries(queries) {
  return {
    queries,
    resultsPerPage: 10,
    maxPagesPerQuery: 1,
    languageCode: 'es',
    countryCode: 'es',
    saveHtml: false,
    saveHtmlToKeyValueStore: false,
    includeUnfilteredResults: false,
    mobileResults: false,
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function responseText(body) {
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body || {});
  } catch {
    return '';
  }
}

async function apifyRunSyncGetItems(actorId, token, input) {
  const actorPath = encodeURIComponent(actorId).replace('%7E', '~');
  const url = APIFY_API_BASE + '/acts/' + actorPath + '/run-sync-get-dataset-items?timeout=180';
  let last = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(input),
      });

      const text = await res.text();
      let body = text;
      try {
        body = text ? JSON.parse(text) : [];
      } catch {}

      last = { ok: res.ok, status: res.status, body, attempts: attempt + 1 };
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) return last;
      await sleep(Math.min(2 ** attempt * 5, 30) * 1000);
    } catch (error) {
      last = {
        ok: false,
        status: 0,
        body: { message: error.message },
        attempts: attempt + 1,
      };
      if (attempt === MAX_RETRIES) return last;
      await sleep(Math.min(2 ** attempt * 5, 30) * 1000);
    }
  }

  return last;
}

function extractUrl(item) {
  return clean(
    item.url ||
    item.link ||
    item.organicUrl ||
    item.displayedUrl ||
    item.resultUrl ||
    item.href
  );
}

function extractTitle(item) {
  return clean(item.title || item.name || item.heading || '');
}

function extractDescription(item) {
  return clean(item.description || item.snippet || item.text || item.resultDescription || '');
}

function flattenResults(items) {
  const rows = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (Array.isArray(item.organicResults)) rows.push(...item.organicResults);
    if (Array.isArray(item.results)) rows.push(...item.results);
    rows.push(item);
  }
  return rows;
}

function scoreLinkedInResult(result, ctx) {
  const url = extractUrl(result);
  if (!LINKEDIN_PROFILE.test(url)) return null;

  const title = extractTitle(result);
  const description = extractDescription(result);
  const haystack = lower([title, description, url].join(' '));
  const company = lower(ctx.companyName);
  const city = lower(ctx.city);
  const domain = lower(ctx.domain);

  if (BAD_TITLE.test(title)) return null;

  let score = 0;
  let matchedRole = '';

  for (const rule of TITLE_RULES) {
    if (rule.terms.some((term) => haystack.includes(lower(term)))) {
      score += rule.score;
      matchedRole = rule.label;
      break;
    }
  }

  if (!matchedRole) return null;
  if (company && haystack.includes(company)) score += 35;
  if (domain && haystack.includes(domain)) score += 20;
  if (city && haystack.includes(city)) score += 10;
  if (haystack.includes('/in/')) score += 10;

  return {
    url: url.split('?')[0].replace(/\/$/, ''),
    title,
    description,
    score,
    matchedRole,
  };
}

function chooseBestProfile(items, ctx) {
  const seen = new Set();
  const scored = [];

  for (const result of flattenResults(items)) {
    const hit = scoreLinkedInResult(result, ctx);
    if (!hit || seen.has(hit.url)) continue;
    seen.add(hit.url);
    scored.push(hit);
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0] || null;
}

function outputBase(row, status, error, attempts, nowIso, extra = {}) {
  return {
    ...row,
    apollo_status: status,
    apollo_error: error || '',
    apollo_attempts: parseAttempts(row.apollo_attempts) + attempts,
    apollo_last_checked_at: nowIso,
    processed_at: nowIso,
    ...extra,
  };
}

function outputProfile(row, best, attempts, nowIso, extra = {}) {
  return {
    ...row,
    decision_maker_name: clean(row.decision_maker_name),
    decision_maker_first_name: clean(row.decision_maker_first_name),
    decision_maker_last_name: clean(row.decision_maker_last_name),
    decision_maker_job_title: best.matchedRole || clean(row.decision_maker_job_title),
    decision_maker_seniority: clean(row.decision_maker_seniority),
    decision_maker_department: clean(row.decision_maker_department),
    decision_maker_email: clean(row.decision_maker_email),
    decision_maker_email_status: clean(row.decision_maker_email_status),
    decision_maker_phone: clean(row.decision_maker_phone),
    decision_maker_linkedin_url: best.url,
    apollo_person_id: clean(row.apollo_person_id),
    apollo_organization_id: clean(row.apollo_organization_id),
    apollo_status: 'matched_without_email',
    apollo_error: 'LinkedIn URL found via Apify public search: ' + clean(best.title),
    apollo_attempts: parseAttempts(row.apollo_attempts) + attempts,
    apollo_last_checked_at: nowIso,
    processed_at: nowIso,
    ...extra,
  };
}

async function processRow(row) {
  const cfg = row.config || {};
  const nowIso = new Date().toISOString();
  const ctx = companyContext(row);

  if (!toBool(cfg.apollo_enabled)) {
    return outputBase(row, 'skipped', 'search disabled because apollo_enabled is false', 0, nowIso);
  }

  if (!ctx.companyName) {
    return outputBase(row, 'insufficient_company_data', 'Need company_name to search LinkedIn profiles', 0, nowIso);
  }

  if (clean(row.decision_maker_linkedin_url) && !toBool(cfg.overwrite_existing_contact_data)) {
    return outputBase(row, 'skipped', 'decision_maker_linkedin_url already exists', 0, nowIso);
  }

  const tokenInfo = tokenForRow(row);
  if (tokenInfo.error) {
    return outputBase(row, 'api_error', tokenInfo.error, 0, nowIso);
  }

  const queries = buildQueries(ctx);
  const apifyInput = apifyInputForQueries(queries);
  const run = await apifyRunSyncGetItems(APIFY_ACTOR_ID, tokenInfo.token, apifyInput);

  if (!run.ok) {
    const details = responseText(run.body).slice(0, 700);
    return outputBase(
      row,
      run.status === 429 ? 'rate_limited' : 'api_error',
      'Apify error ' + String(run.status || 'network') + ': ' + details,
      run.attempts || 1,
      nowIso,
      { apify_token_env_var: tokenInfo.envName }
    );
  }

  const best = chooseBestProfile(run.body, ctx);
  if (!best) {
    return outputBase(
      row,
      'no_person_found',
      'No LinkedIn profile result matched public search queries: ' + queries.join(' || '),
      run.attempts || 1,
      nowIso,
      { apify_token_env_var: tokenInfo.envName }
    );
  }

  return outputProfile(row, best, run.attempts || 1, nowIso, {
    apify_token_env_var: tokenInfo.envName,
  });
}

const inputRows = $input.all().map((item) => item.json || {});
const output = [];

for (const row of inputRows) {
  output.push({ json: await processRow(row) });
}

return output;
