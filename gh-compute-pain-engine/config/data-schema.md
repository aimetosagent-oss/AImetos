# Esquema de dades

Aquest fitxer descriu l'estructura operativa que crea `apps-script/Code.gs`. Google Sheets es fa servir com a base de dades operacional i cap flux elimina files.

## `00_CONFIG`

Columnes: `key`, `value`, `description`.

Claus inicials: `BUSINESS_NAME`, `DEFAULT_OUTREACH_LANGUAGE`, `TARGET_COUNTRIES`, `MIN_QUALIFIED_SCORE`, `PRIORITY_A_SCORE`, `MAX_ITEMS_PER_QUERY`, `MAX_RAW_TEXT_CHARACTERS`, `APIFY_POLL_INTERVAL_SECONDS`, `APIFY_MAX_POLLS`, `APOLLO_ENABLED`, `SUMMARY_EMAIL_ENABLED`, `SUMMARY_EMAIL_TO`, `SEARCH_QUERIES_JSON`, `APIFY_SOURCES_JSON`.

## `01_EMPRESAS_OBJETIVO`

Columnes: `company_id`, `company_name`, `website`, `domain`, `linkedin_company_url`, `country`, `city`, `sector`, `company_size`, `source`, `first_seen_at`, `last_seen_at`, `status`, `notes`.

Valors permesos de `status`: `Nuevo`, `Analizando`, `Validado`, `Contactado`, `No apto`.

## `02_PAIN_SIGNALS`

Columnes: `signal_id`, `company_id`, `company_name`, `source_url`, `source_type`, `source_title`, `raw_text`, `pain_category`, `pain_signal`, `evidence_quote`, `evidence_strength`, `detected_at`, `analyzed_at`, `status`, `dedupe_key`, `run_id`.

Valors permesos de `pain_category`: `performance`, `iterations`, `automation`, `hiring_signal`, `no_clear_pain`.

Valors permesos de `evidence_strength`: `high`, `medium`, `low`.

Valors permesos de `status`: `Nuevo`, `Clasificado`, `Descartado`, `Cualificado`.

## `03_LEADS_CUALIFICADOS`

Columnes: `lead_id`, `company_id`, `company_name`, `website`, `domain`, `country`, `sector`, `decision_maker_name`, `decision_maker_role`, `linkedin_url`, `email`, `email_source`, `enrichment_status`, `pain_summary`, `pain_hypothesis`, `recommended_service`, `outreach_angle`, `score`, `priority`, `evidence_strength`, `source_url`, `lead_status`, `outreach_status`, `next_action`, `created_at`, `updated_at`, `last_seen_at`, `notes`.

Valors permesos de `priority`: `A`, `B`, `C`.

Valors permesos de `enrichment_status`: `Pending`, `Not needed`, `Enriched`, `No email found`, `Disabled`.

Valors permesos de `lead_status`: `Pending review`, `Validated`, `Contacted`, `Responded`, `Discarded`.

Valors permesos de `outreach_status`: `Pending`, `Draft generated`, `Reviewed`, `Sent manually`, `No contact`.

## `04_RUN_LOG`

Columnes: `run_id`, `workflow_name`, `started_at`, `finished_at`, `status`, `sources_requested`, `raw_items`, `new_signals`, `qualified_leads`, `errors`, `details`.

Valors permesos de `status`: `Started`, `Completed`, `Completed with errors`, `Failed`, `Skipped`.

## `05_OUTREACH_DRAFTS`

Columnes: `draft_id`, `lead_id`, `company_name`, `contact_name`, `contact_role`, `channel`, `language`, `subject`, `message`, `evidence_used`, `status`, `generated_at`, `reviewed_at`, `sent_at`, `notes`.

Valors permesos de `channel`: `LinkedIn`, `Email`.

Valors permesos de `status`: `Draft`, `Reviewed`, `Sent manually`, `Discarded`.
