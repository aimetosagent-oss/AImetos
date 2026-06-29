# AImetos Outbound Control

A portable, static dashboard for reviewing and maintaining the outbound lead CSV exported from Google Sheets. It has no backend, framework, build step, or external dependency.

## Run it

Open `index.html` directly in a browser, or serve the repository with any static server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/dashboard/`. The same directory can be published with GitHub Pages.

## Workflow

1. Export the outbound Google Sheet as CSV.
2. Select **Import CSV**. A new import replaces the browser's current dataset.
3. Search, filter, select a row, and edit fields in the detail panel. The three statuses are also editable directly in the table.
4. Edits save immediately to `localStorage` in that browser.
5. Select **Export CSV** to download the full dataset in the original 25-column schema.

The parser handles escaped quotes, commas, CRLF/LF line endings, UTF-8 BOMs, and multiline quoted values. Missing columns are reported and normalized to empty values; extra fields are ignored with a warning.

## Structure

- `index.html` — semantic UI and script loading
- `styles.css` — responsive, dependency-free presentation
- `parser.js` — CSV parser, lead normalization, and CSV serialization
- `storage.js` — versioned browser persistence and future sync boundaries
- `app.js` — state, filtering, rendering, editing, import, and export

The normalized in-memory model groups messages and metadata while import/export preserves this CSV order:

`id, company_name, website, email, telefono, city, target_type, sector, offer_type, landing_url, source_url, pain_hypothesis, outreach_status, language, first_email_subject, first_email_body, followup1_subject, followup1_body, followup2_subject, followup2_body, last_contact_date, followup_step, ghl_contact_id, lead_status, reply_status`

## Upgrade path

Inactive integration boundaries are documented in `storage.js` for a future Google Sheets sync, n8n update webhook, or PostgreSQL/API migration. They are intentionally not implemented in this static MVP.

Browser storage is per origin. Data opened through `file://` and data served through `http://localhost` therefore live in separate browser storage areas; export before switching origins if browser edits matter.
