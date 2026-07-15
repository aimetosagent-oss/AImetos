import fs from 'node:fs';
import path from 'node:path';
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const files = fs.readdirSync(DIR).filter((file) => /^\d{2}_.*\.json$/.test(file)).sort();
const failures = [];

const fail = (file, message) => failures.push(`${file}: ${message}`);

for (const file of files) {
  const fullPath = path.join(DIR, file);
  let workflow;
  try {
    workflow = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    fail(file, `invalid JSON: ${error.message}`);
    continue;
  }

  if (workflow.active !== false) fail(file, 'workflow must be disabled');
  if (workflow.settings?.saveDataErrorExecution !== 'all') fail(file, 'error executions are not saved');

  const names = workflow.nodes.map((node) => node.name);
  const ids = workflow.nodes.map((node) => node.id);
  const nameSet = new Set(names);
  if (nameSet.size !== names.length) fail(file, 'duplicate node name');
  if (new Set(ids).size !== ids.length) fail(file, 'duplicate node id');
  if (!nameSet.has('SET — CONFIG')) fail(file, 'missing SET — CONFIG');

  for (const node of workflow.nodes) {
    if (node.credentials) fail(file, `${node.name} embeds credentials`);

    if (node.type === 'n8n-nodes-base.code') {
      try {
        new AsyncFunction('$input', '$env', '$', 'fetch', 'URL', node.parameters.jsCode);
      } catch (error) {
        fail(file, `${node.name} JavaScript syntax error: ${error.message}`);
      }
    }

    if (node.type === 'n8n-nodes-base.googleSheets' && ['append', 'update', 'appendOrUpdate'].includes(node.parameters.operation)) {
      const mapped = Object.keys(node.parameters.columns?.value || {});
      if (mapped.includes('id')) fail(file, `${node.name} writes protected formula column id`);
      if (node.parameters.operation === 'update' && !(node.parameters.columns?.matchingColumns || []).length) {
        fail(file, `${node.name} update has no match column`);
      }
    }

    const serialized = JSON.stringify(node.parameters || {});
    for (const match of serialized.matchAll(/\$\('([^']+)'\)/g)) {
      if (!nameSet.has(match[1])) fail(file, `${node.name} references missing node ${match[1]}`);
    }
  }

  for (const [source, groups] of Object.entries(workflow.connections || {})) {
    if (!nameSet.has(source)) fail(file, `connection source ${source} does not exist`);
    for (const output of groups.main || []) {
      for (const edge of output || []) {
        if (!nameSet.has(edge.node)) fail(file, `connection target ${edge.node} does not exist`);
      }
    }
  }

  const triggerNames = workflow.nodes
    .filter((node) => ['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.webhook'].includes(node.type))
    .map((node) => node.name);
  for (const triggerName of triggerNames) {
    const targets = (workflow.connections?.[triggerName]?.main?.[0] || []).map((edge) => edge.node);
    if (!targets.includes('SET — CONFIG')) fail(file, `${triggerName} does not start through SET — CONFIG`);
  }
}

if (files.length !== 5) failures.push(`expected 5 workflow JSON files, found ${files.length}`);

const allText = files.map((file) => fs.readFileSync(path.join(DIR, file), 'utf8')).join('\n');
for (const requiredEnv of [
  'APIFY_API_TOKEN_YOLANDA',
  'APOLLO_API_KEY_YOLANDA',
  'NEVERBOUNCE_API_KEY_YOLANDA',
  'INSTANTLY_API_KEY_YOLANDA',
  'INSTANTLY_WEBHOOK_SECRET_YOLANDA',
  'GHL_PRIVATE_INTEGRATION_TOKEN_YOLANDA',
]) {
  if (!allText.includes(requiredEnv)) failures.push(`missing environment variable reference ${requiredEnv}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${files.length} workflows: JSON, JavaScript syntax, nodes, connections, match columns, no embedded credentials, and protected id column.`);
