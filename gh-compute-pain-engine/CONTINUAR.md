# Continuar el treball n8n / AImetos Scrap Grasshopper

## Estat actual

- Els workflows locals corregits son a `n8n/workflows/`.
- Els 4 workflows tenen node inicial `CREDENCIALS`.
- El workflow 01 esta adaptat a Apify `run-sync-get-dataset-items` amb `endpoint_url`.
- Apollo esta preparat pero desactivat (`apollo_enabled=false`).
- Validacio local passada amb `npm run validate`.

## Fitxers importants

- `n8n/workflows/01-gh-compute-pain-detector.json`
- `n8n/workflows/02-gh-compute-apollo-enrichment.json`
- `n8n/workflows/03-gh-compute-outreach-drafts.json`
- `n8n/workflows/04-gh-compute-error-handler.json`
- `docs/setup.md`
- `docs/apify-task-setup.md`

## Abans de canviar d'ordinador

Des del PC actual, executar `acabar.bat` i escollir el projecte `AImetos`.

Aixo fa:

1. `git add .`
2. `git commit -m "update"` si hi ha canvis
3. `git pull --rebase origin main`
4. `git push origin main`

## En un altre ordinador

1. Obrir la carpeta on tens els `.bat`.
2. Executar `començar.bat`.
3. Escollir el projecte `AImetos`.
4. Obrir Codex sobre aquest repositori.
5. Dir-li a Codex:

```text
Continua el projecte gh-compute-pain-engine. Llegeix gh-compute-pain-engine/CONTINUAR.md i revisa els workflows n8n locals. Vull pujar-los/provar-los a n8n sense canviar noms ni crear OLD.
```

## Per aplicar a n8n

Opcio mes segura:

- Crear una API key de n8n.
- Donar-la a Codex en un fitxer local temporal o variable d'entorn local.
- Codex pot llegir els workflows existents, preservar ids/credencials i aplicar el patch.

Opcio manual:

- Importar o enganxar el JSON dels workflows locals.
- Revisar/reassignar credencials Google Sheets als nodes Sheets.
- Provar workflows 01, 03 i 04.
- No provar Apollo fins posar `apollo_enabled=true` i configurar `APOLLO_API_KEY` / `APOLLO_ENRICH_ENDPOINT`.

## Variables EasyPanel esperades

```env
GOOGLE_SHEET_ID=1Dd-BimZHX6n8sSTXpdDmVmf0qxNOwMB0cBML0DlbPDw
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
N8N_EDITOR_BASE_URL=https://demo-n8n.abrfjv.easypanel.host
APIFY_TOKEN_CLIENT_01=...
APIFY_TOKEN_CLIENT_02=...
APIFY_TOKEN_CLIENT_03=...
APIFY_TOKEN_CLIENT_04=...
APIFY_TOKEN_CLIENT_05=...
APIFY_TOKEN_CLIENT_06=...
APIFY_TOKEN_CLIENT_07=...
APIFY_TOKEN_CLIENT_08=...
APOLLO_API_KEY=
APOLLO_ENRICH_ENDPOINT=
```

## Nota sobre el loop

Al node `Loop Work Items`, es correcte que surti per `Loop Branch`.

- `Loop Branch`: processa cada item individual.
- `Done Branch`: nomes surt quan ja ha acabat tots els items.

