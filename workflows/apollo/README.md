# Apollo decision maker enrichment

Workflow n8n importable per llegir empreses de la pestanya existent `Hoja 1`, buscar decisors a Apollo, seleccionar un sol candidat amb regles deterministes i escriure el resultat a la pestanya nova `LEADS`.

## Fitxers

- `Apollo_Decision_Maker_Enrichment.json`: workflow n8n importable.
- `../../templates/Apollo_Lead_Enrichment_Template.xlsx`: plantilla local.
- `../../templates/Apollo_Lead_Enrichment_LEADS.csv`: CSV de la pestanya `LEADS`.
- `../../templates/Apollo_Lead_Enrichment_CONFIG.csv`: CSV de la pestanya `CONFIG`.

## Que fa

1. Trigger manual.
2. Llegeix `CONFIG`.
3. Llegeix la font `Hoja 1` en mode nomes lectura.
4. Llegeix `LEADS` per saber que ja esta enriquit.
5. Processa nomes leads nous, `retry`, o caducats segons `RECHECK_AFTER_DAYS`.
6. Normalitza domini i nom d'empresa sense deduir dades externes.
7. Cerca persones a Apollo amb `POST https://api.apollo.io/api/v1/mixed_people/api_search`.
8. Puntua candidats amb regles de carrec i seniority.
9. Enriqueix nomes el millor candidat amb `POST https://api.apollo.io/api/v1/people/match`.
10. Escriu o actualitza el resultat a `LEADS` per `lead_id`.
11. Retorna resum final.

## Que no fa

- No crea llistes internes a Apollo.
- No envia emails.
- No genera emails inventats.
- No utilitza IA per seleccionar el contacte.
- No usa Redis, PostgreSQL ni microserveis.
- No guarda secrets al JSON, al Sheet ni als logs.

## Google Sheet

El spreadsheet configurat es:

`https://docs.google.com/spreadsheets/d/1JBuVbNMQTpk9BBxT8Lar6XFKSlzsvmqRw4cppbuRmjo/edit`

La font existent es:

- `Hoja 1`: entrada amb uns 12.000 leads. El workflow nomes la llegeix.

S'han creat nomes dues pestanyes noves:

- `LEADS`
- `CONFIG`

Les pestanyes originals `Hoja 1`, `INPUT` i `CONTROL INPUT` no es modifiquen.

## Mapping de Hoja 1

| Hoja 1 | LEADS |
| --- | --- |
| `id` | `lead_id` |
| `company_name` | `company_name` |
| `website` | `company_website` |
| `city` | `company_city` |
| `sector` o `target_type` | `company_sector` |
| `source_url` | `source` |

Els camps de contacte retornats per Apollo s'escriuen a les columnes `decision_maker_*` i `apollo_*` de `LEADS`.

## Credencials

Configura a n8n/EasyPanel:

- `APOLLO_API_KEY`: API key d'Apollo.
- `GOOGLE_SHEETS_CREDENTIALS`: credencial OAuth2 de Google Sheets amb permis d'edicio.

Apollo usa header `x-api-key`. El workflow no desa la clau.

## API Apollo verificada

Fonts oficials:

- People API Search: https://docs.apollo.io/reference/people-api-search
- People Enrichment: https://docs.apollo.io/reference/people-enrichment
- Authentication: https://docs.apollo.io/reference/authentication
- API pricing: https://docs.apollo.io/docs/api-pricing
- Rate limits: https://docs.apollo.io/reference/rate-limits

Notes operatives:

- People API Search no consumeix credits segons Apollo.
- People API Search requereix master API key.
- People Enrichment pot consumir credits quan retorna dades enriquides.
- L'API key ha de tenir scope per People Enrichment o ser master key.
- Els limits depenen del pla; Apollo exposa `POST /usage_stats/api_usage_stats` per revisar limits amb master key.

## Posada en marxa n8n

1. Importa `Apollo_Decision_Maker_Enrichment.json`.
2. Obre els nodes Google Sheets i selecciona `GOOGLE_SHEETS_CREDENTIALS`.
3. Revisa `Configuracio base`: spreadsheet ID, `LEADS`, `CONFIG`.
4. Configura `APOLLO_API_KEY` com a variable d'entorn segura.
5. A `CONFIG`, deixa `APOLLO_ENABLED=true` nomes quan vulguis permetre crides reals.
6. Per la primera prova, deixa `BATCH_SIZE=1` a `CONFIG`.
7. Executa manualment.

No executis el workflow contra Apollo fins que el consum de credits estigui aprovat.

## Com provar amb una sola empresa

El workflow llegira la primera fila util de `Hoja 1` segons `BATCH_SIZE=1` i escriura el resultat a `LEADS`.

Per reprocessar un lead concret, busca el seu `lead_id` a `LEADS` i posa `apollo_status=retry`.

## Com desactivar-lo

Posa `APOLLO_ENABLED=false` a `CONFIG`. El workflow marcara les files elegibles com `skipped` sense cridar Apollo.

## Reprendre errors

Per reprendre una fila, posa:

- `apollo_status=retry`
- deixa `apollo_error` com a nota de diagnostic o buida'l manualment.

El workflow no reprocessa `matched` ni `completed` tret que es canvii l'estat.

## Dades personals i RGPD

Nom, carrec, email, telefon i LinkedIn son dades personals. Abans d'usar-les comercialment cal revisar base juridica, minimizacio, retencio, oposicio/supressio i permisos segons RGPD i les condicions d'Apollo.
