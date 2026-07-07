const SPREADSHEET_NAME = 'GH Compute Lead Engine';

const DEFAULT_SEARCH_QUERIES = [
  { query: '"Grasshopper" "computational designer"', country: 'Spain', countryCode: 'ES' },
  { query: '"Rhino Grasshopper" "job"', country: 'Spain', countryCode: 'ES' },
  { query: '"parametric design" "Grasshopper"', country: 'Spain', countryCode: 'ES' },
  { query: '"computational design" "Rhino"', country: 'Spain', countryCode: 'ES' },
  { query: '"facade" "Grasshopper"', country: 'Spain', countryCode: 'ES' },
  { query: '"Grasshopper" "optimization"', country: 'Spain', countryCode: 'ES' },
  { query: '"Rhino.Compute" OR "Hops"', country: 'Spain', countryCode: 'ES' },
  { query: '"Grasshopper" "slow"', country: 'Spain', countryCode: 'ES' },
  { query: '"Grasshopper" "crash"', country: 'Spain', countryCode: 'ES' },
  { query: '"Grasshopper" "automation"', country: 'Spain', countryCode: 'ES' }
];

const DEFAULT_APIFY_SOURCES = [
  {
    id: 'google_search',
    enabled: true,
    task_id: 'REPLACE_WITH_APIFY_TASK_ID',
    apify_token_env_var: 'APIFY_TOKEN',
    result_type: 'web_search',
    input_template: {
      queries: '{{query}}',
      resultsPerPage: 10,
      maxPagesPerQuery: 1,
      languageCode: 'en',
      countryCode: '{{countryCode}}'
    }
  },
  {
    id: 'jobs',
    enabled: false,
    task_id: 'REPLACE_WITH_APIFY_TASK_ID',
    apify_token_env_var: 'APIFY_TOKEN',
    result_type: 'jobs',
    input_template: {
      query: '{{query}}',
      location: '{{country}}',
      maxResults: 20
    }
  }
];

const SHEET_DEFINITIONS = {
  '00_CONFIG': {
    headers: ['key', 'value', 'description']
  },
  '01_EMPRESAS_OBJETIVO': {
    headers: ['company_id', 'company_name', 'website', 'domain', 'linkedin_company_url', 'country', 'city', 'sector', 'company_size', 'source', 'first_seen_at', 'last_seen_at', 'status', 'notes'],
    validations: {
      status: ['Nuevo', 'Analizando', 'Validado', 'Contactado', 'No apto']
    }
  },
  '02_PAIN_SIGNALS': {
    headers: ['signal_id', 'company_id', 'company_name', 'source_url', 'source_type', 'source_title', 'raw_text', 'pain_category', 'pain_signal', 'evidence_quote', 'evidence_strength', 'detected_at', 'analyzed_at', 'status', 'dedupe_key', 'run_id'],
    validations: {
      pain_category: ['performance', 'iterations', 'automation', 'hiring_signal', 'no_clear_pain'],
      evidence_strength: ['high', 'medium', 'low'],
      status: ['Nuevo', 'Clasificado', 'Descartado', 'Cualificado']
    }
  },
  '03_LEADS_CUALIFICADOS': {
    headers: ['lead_id', 'company_id', 'company_name', 'website', 'domain', 'country', 'sector', 'decision_maker_name', 'decision_maker_role', 'linkedin_url', 'email', 'email_source', 'enrichment_status', 'pain_summary', 'pain_hypothesis', 'recommended_service', 'outreach_angle', 'score', 'priority', 'evidence_strength', 'source_url', 'lead_status', 'outreach_status', 'next_action', 'created_at', 'updated_at', 'last_seen_at', 'notes'],
    validations: {
      priority: ['A', 'B', 'C'],
      enrichment_status: ['Pending', 'Not needed', 'Enriched', 'No email found', 'Disabled'],
      lead_status: ['Pending review', 'Validated', 'Contacted', 'Responded', 'Discarded'],
      outreach_status: ['Pending', 'Draft generated', 'Reviewed', 'Sent manually', 'No contact']
    }
  },
  '04_RUN_LOG': {
    headers: ['run_id', 'workflow_name', 'started_at', 'finished_at', 'status', 'sources_requested', 'raw_items', 'new_signals', 'qualified_leads', 'errors', 'details'],
    validations: {
      status: ['Started', 'Completed', 'Completed with errors', 'Failed', 'Skipped']
    }
  },
  '05_OUTREACH_DRAFTS': {
    headers: ['draft_id', 'lead_id', 'company_name', 'contact_name', 'contact_role', 'channel', 'language', 'subject', 'message', 'evidence_used', 'status', 'generated_at', 'reviewed_at', 'sent_at', 'notes'],
    validations: {
      channel: ['LinkedIn', 'Email'],
      status: ['Draft', 'Reviewed', 'Sent manually', 'Discarded']
    }
  }
};

const DEFAULT_CONFIG = [
  ['BUSINESS_NAME', 'AImetos / Growth Hunters IA', 'Nom intern del sistema comercial.'],
  ['DEFAULT_OUTREACH_LANGUAGE', 'es', 'Idioma per defecte dels esborranys comercials.'],
  ['TARGET_COUNTRIES', 'Spain,Portugal,France,United Kingdom', 'Paisos inicials de recerca.'],
  ['MIN_QUALIFIED_SCORE', '65', 'Puntuacio minima per crear lead qualificat.'],
  ['PRIORITY_A_SCORE', '80', 'Llindar de prioritat A.'],
  ['MAX_ITEMS_PER_QUERY', '20', 'Limit de resultats normalitzats per consulta i font.'],
  ['MAX_RAW_TEXT_CHARACTERS', '6000', 'Longitud maxima de text que s envia a OpenAI.'],
  ['APIFY_POLL_INTERVAL_SECONDS', '20', 'Interval base entre comprovacions de run d Apify.'],
  ['APIFY_MAX_POLLS', '12', 'Nombre maxim de comprovacions per run d Apify.'],
  ['APOLLO_ENABLED', 'FALSE', 'Activa el flux opcional Apollo quan sigui TRUE.'],
  ['SUMMARY_EMAIL_ENABLED', 'FALSE', 'Crea resum en log quan sigui TRUE; no envia correus.'],
  ['SUMMARY_EMAIL_TO', 'hola@aimetos.com', 'Destinatari intern per esborranys de resum.'],
  ['SEARCH_QUERIES_JSON', JSON.stringify(DEFAULT_SEARCH_QUERIES, null, 2), 'Consultes inicials en JSON.'],
  ['APIFY_SOURCES_JSON', JSON.stringify(DEFAULT_APIFY_SOURCES, null, 2), 'Fonts Apify i input_template en JSON.']
];

function setupGhComputeLeadEngine() {
  const spreadsheet = getOrCreateSpreadsheet_();
  Object.keys(SHEET_DEFINITIONS).forEach(function(sheetName) {
    const definition = SHEET_DEFINITIONS[sheetName];
    const sheet = ensureSheet_(spreadsheet, sheetName, definition.headers);
    applyBaseFormatting_(sheet, definition.headers);
    applyValidations_(sheet, definition.headers, definition.validations || {});
    applyConditionalFormatting_(sheet, sheetName, definition.headers);
  });
  ensureDefaultConfig_(spreadsheet.getSheetByName('00_CONFIG'));
  SpreadsheetApp.flush();
  Logger.log('Spreadsheet ready: ' + spreadsheet.getUrl());
  return { id: spreadsheet.getId(), url: spreadsheet.getUrl() };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GH Compute')
    .addItem('Configurar estructura', 'setupGhComputeLeadEngine')
    .addToUi();
}

function getOrCreateSpreadsheet_() {
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.openById(files.next().getId());
  }
  return SpreadsheetApp.create(SPREADSHEET_NAME);
}

function ensureSheet_(spreadsheet, sheetName, requiredHeaders) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });

  const hasAnyHeader = existingHeaders.some(function(value) { return value !== ''; });
  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return sheet;
  }

  const present = new Set(existingHeaders.filter(Boolean));
  let writeColumn = sheet.getLastColumn();
  requiredHeaders.forEach(function(header) {
    if (!present.has(header)) {
      writeColumn += 1;
      sheet.getRange(1, writeColumn).setValue(header);
      present.add(header);
    }
  });
  return sheet;
}

function applyBaseFormatting_(sheet, headers) {
  const columnCount = Math.max(sheet.getLastColumn(), headers.length);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setFontWeight('bold')
    .setBackground('#f1f5f9')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sheet.autoResizeColumns(1, columnCount);

  const existingFilter = sheet.getFilter();
  if (!existingFilter) {
    const rows = Math.max(sheet.getMaxRows(), 2);
    sheet.getRange(1, 1, rows, columnCount).createFilter();
  }
}

function applyValidations_(sheet, headers, validations) {
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Object.keys(validations).forEach(function(header) {
    const index = currentHeaders.indexOf(header);
    if (index === -1) return;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(validations[header], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, index + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  });
}

function applyConditionalFormatting_(sheet, sheetName, headers) {
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rules = [];

  if (sheetName === '03_LEADS_CUALIFICADOS') {
    const priorityColumn = currentHeaders.indexOf('priority') + 1;
    if (priorityColumn > 0) {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('A')
        .setBackground('#dcfce7')
        .setRanges([sheet.getRange(2, priorityColumn, Math.max(sheet.getMaxRows() - 1, 1), 1)])
        .build());
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('C')
        .setBackground('#fee2e2')
        .setRanges([sheet.getRange(2, priorityColumn, Math.max(sheet.getMaxRows() - 1, 1), 1)])
        .build());
    }
  }

  if (sheetName === '04_RUN_LOG') {
    const statusColumn = currentHeaders.indexOf('status') + 1;
    if (statusColumn > 0) {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('Failed')
        .setBackground('#fee2e2')
        .setRanges([sheet.getRange(2, statusColumn, Math.max(sheet.getMaxRows() - 1, 1), 1)])
        .build());
    }
  }

  if (rules.length) {
    sheet.setConditionalFormatRules(rules);
  }
}

function ensureDefaultConfig_(configSheet) {
  const headers = configSheet.getRange(1, 1, 1, configSheet.getLastColumn()).getValues()[0];
  const keyColumn = headers.indexOf('key') + 1;
  const valueColumn = headers.indexOf('value') + 1;
  const descriptionColumn = headers.indexOf('description') + 1;
  if (!keyColumn || !valueColumn || !descriptionColumn) {
    throw new Error('00_CONFIG must contain key, value and description columns.');
  }

  const lastRow = Math.max(configSheet.getLastRow(), 1);
  const existingKeys = new Set();
  if (lastRow > 1) {
    configSheet.getRange(2, keyColumn, lastRow - 1, 1).getValues().forEach(function(row) {
      const key = String(row[0] || '').trim();
      if (key) existingKeys.add(key);
    });
  }

  DEFAULT_CONFIG.forEach(function(row) {
    if (!existingKeys.has(row[0])) {
      configSheet.appendRow(row);
      existingKeys.add(row[0]);
    }
  });
}
