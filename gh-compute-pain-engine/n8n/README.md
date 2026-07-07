# Workflows n8n

Importa aquests fitxers amb els workflows desactivats:

1. `workflows/04-gh-compute-error-handler.json`
2. `workflows/01-gh-compute-pain-detector.json`
3. `workflows/02-gh-compute-apollo-enrichment.json`
4. `workflows/03-gh-compute-outreach-drafts.json`

Tots tenen `settings.timezone` a `Europe/Madrid` i `active: false`.

## Workflows

- `GH Compute — Pain Detector`: flux principal Apify, OpenAI, puntuació determinista i Google Sheets.
- `GH Compute — Apollo Optional Enrichment`: enriquiment aïllat, només si Apollo està activat i configurat.
- `GH Compute — Outreach Drafts`: crea esborranys revisables, mai envia.
- `GH Compute — Error Handler`: rep errors globals de n8n i escriu a `04_RUN_LOG`.

## Configuració de l'error workflow

A n8n, ves a la configuració global d'errors i selecciona `GH Compute — Error Handler` com a workflow d'error. No activa reintents ni envia comunicacions externes.
