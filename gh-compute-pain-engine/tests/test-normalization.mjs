import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'apify-results.json'), 'utf8'));

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function isSocialUrl(value) {
  return /(linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com)/i.test(value || '');
}

function normalizeItem(item, context = {}) {
  const sourceUrl = normalizeUrl(item.url || item.link || item.source_url || item.website);
  if (!sourceUrl) return null;

  const website = !isSocialUrl(item.website) ? normalizeUrl(item.website) : '';
  const sourceTitle = cleanText(item.title || item.jobTitle || item.position || item.name);
  const companyName = cleanText(item.companyName || item.company_name || item.company || item.employer || item.organization);
  const rawText = cleanText([
    sourceTitle,
    item.description,
    item.snippet,
    item.text,
    item.raw_text,
    item.location
  ].filter(Boolean).join(' ')).slice(0, context.maxChars || 6000);

  if (!companyName || rawText.length < 40) return null;

  const urlForDomain = website || sourceUrl;
  const domain = new URL(urlForDomain).hostname.replace(/^www\./, '');
  const dedupeBase = sourceUrl || `${companyName}|${sourceTitle}|${rawText.slice(0, 120)}`;
  const dedupeKey = crypto.createHash('sha256').update(dedupeBase.toLowerCase()).digest('hex');

  return {
    run_id: context.runId || '',
    source_id: context.sourceId || '',
    source_type: context.sourceType || '',
    company_name: companyName,
    website,
    domain,
    country: cleanText(item.country || context.country || ''),
    source_url: sourceUrl,
    source_title: sourceTitle,
    raw_text: rawText,
    raw_item_json: JSON.stringify(item),
    detected_at: context.detectedAt || '',
    dedupe_key: dedupeKey
  };
}

const normalized = fixtures.map((item) => normalizeItem(item, {
  runId: 'run-test',
  sourceId: 'fixture',
  sourceType: 'web_search',
  country: 'Spain',
  detectedAt: '2026-07-07T08:30:00.000Z'
})).filter(Boolean);

assert.ok(normalized.length >= 4, 'expected multiple normalized records');
assert.ok(normalized.every((item) => item.source_url && item.dedupe_key), 'source URL and dedupe key are required');
assert.equal(normalized.filter((item) => item.source_url === 'https://example.com/facade-slow').length, 2, 'duplicate URL normalizes consistently');
assert.equal(normalized.find((item) => item.company_name === 'Fabrication Lab').domain, 'fabrication.example');
assert.ok(!normalized.some((item) => item.company_name === 'Missing URL Ltd'), 'result without URL is rejected');

console.log('test-normalization: ok');
