# Troubleshooting

## Missing Google Sheet credentials

Diagnòstic: els nodes Google Sheets fallen amb error de credencial o OAuth.

Resolució:

1. Obre el workflow a n8n.
2. Selecciona cada node Google Sheets.
3. Assigna la credencial OAuth correcta.
4. Executa el node manualment amb una fila de prova.

## Invalid `GOOGLE_SHEET_ID`

Diagnòstic: Google Sheets retorna not found o permission denied.

Resolució:

1. Obre `GH Compute Lead Engine`.
2. Copia només l'ID entre `/d/` i `/edit`.
3. Actualitza `GOOGLE_SHEET_ID` a l'entorn n8n.
4. Reinicia n8n.
5. Executa `Read Config`.

## Apify 401

Diagnòstic: `Start Apify Task` o `Poll Apify Run` retorna 401.

Resolució:

1. Verifica `APIFY_TOKEN` a l'entorn n8n.
2. Confirma que el token té accés a les Tasks.
3. Reinicia n8n.
4. Executa manualment el workflow 01.

## Apify task misconfiguration

Diagnòstic: Apify retorna 400 o el dataset no conté camps útils.

Resolució:

1. Obre la Task a Apify.
2. Executa-la manualment.
3. Mira quins camps d'input espera.
4. Ajusta `input_template` a `00_CONFIG.APIFY_SOURCES_JSON`.
5. Torna a provar la Task abans de reactivar la font.

## Apify run timeout

Diagnòstic: el run acaba com `TIMED-OUT` o supera `APIFY_MAX_POLLS`.

Resolució:

1. Redueix `MAX_ITEMS_PER_QUERY`.
2. Redueix pàgines o resultats dins `input_template`.
3. Augmenta `APIFY_MAX_POLLS` només si la Task manual acaba correctament.
4. Si persisteix, posa `enabled` a `false` per aquella font.

## Empty Apify dataset

Diagnòstic: run `SUCCEEDED` amb zero resultats normalitzats.

Resolució:

1. Obre el dataset a Apify.
2. Verifica que hi ha `url` o `link`.
3. Verifica que hi ha text classificable.
4. Ajusta consultes a `SEARCH_QUERIES_JSON`.
5. Ajusta o canvia la Task.

## Invalid OpenAI JSON

Diagnòstic: `Parse OpenAI Classification` registra `Invalid OpenAI JSON`.

Resolució:

1. Verifica `OPENAI_MODEL`.
2. Revisa que el model admeti sortida estructurada.
3. Redueix `MAX_RAW_TEXT_CHARACTERS`.
4. Torna a executar manualment.

## OpenAI 429 or 5xx

Diagnòstic: el node OpenAI retorna rate limit o error temporal.

Resolució:

1. Espera uns minuts.
2. Redueix `MAX_ITEMS_PER_QUERY`.
3. Revisa límits del compte OpenAI.
4. Torna a executar manualment.

## Google Sheets duplicate rows

Diagnòstic: apareixen files repetides a empreses o leads.

Resolució:

1. Verifica que `company_id`, `lead_id` i `dedupe_key` tenen valor.
2. No editis manualment aquests identificadors.
3. Executa `npm test` per validar normalització.
4. Si una Task envia URL amb tracking variable, ajusta la Task o la font perquè lliuri URL canònica.

## Apollo disabled behavior

Diagnòstic: el workflow 02 escriu `Skipped`.

Resolució:

1. Confirma que `APOLLO_ENABLED` està a `FALSE`.
2. No cal cap acció si Apollo no es fa servir.
3. El pipeline principal continua operatiu.

## Apollo missing key behavior

Diagnòstic: `APOLLO_ENABLED=TRUE` però el workflow 02 escriu `Skipped`.

Resolució:

1. Configura `APOLLO_API_KEY`.
2. Configura `APOLLO_ENRICH_ENDPOINT`.
3. Reinicia n8n.
4. Executa workflow 02 manualment.

## Error handler not configured

Diagnòstic: errors de workflow no apareixen a `04_RUN_LOG`.

Resolució:

1. Importa `04-gh-compute-error-handler.json`.
2. Obre la configuració global d'errors de n8n.
3. Selecciona `GH Compute — Error Handler`.
4. Desa i prova amb una execució fallida controlada.

## Schedule not executing in Europe/Madrid

Diagnòstic: els workflows s'executen a una hora inesperada.

Resolució:

1. Verifica `TZ=Europe/Madrid` a l'entorn del servei.
2. Verifica `settings.timezone` als workflows.
3. Reinicia n8n.
4. Revisa la zona horària de l'host només si el problema continua.
