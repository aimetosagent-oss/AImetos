# CONFIG

La pestanya `CONFIG` te tres columnes: `KEY`, `VALUE`, `DESCRIPTION`.

| KEY | Default | Description |
| --- | --- | --- |
| `SOURCE_SHEET_NAME` | `Hoja 1` | Pestanya existent amb empreses/leads. Nomes lectura. |
| `APOLLO_ENABLED` | `true` | Activa o desactiva crides Apollo. |
| `BATCH_SIZE` | `10` | Files maximes processades per execucio. |
| `MAX_CANDIDATES_PER_COMPANY` | `10` | Resultats maxims retornats per empresa. |
| `OVERWRITE_EXISTING_CONTACT_DATA` | `false` | Si es `false`, preserva dades manuals existents. |
| `RECHECK_AFTER_DAYS` | `90` | Dies abans de tornar a consultar estats no finals. |
| `COUNTRY_DEFAULT` | `Spain` | Pais per defecte quan la fila no l'indica. |
| `APOLLO_API_KEY_ENV_VAR` | `APOLLO_API_KEY` | Nom de la variable d'entorn segura. |
| `WORKFLOW_VERSION` | `1.0.0` | Versio del workflow. |

La clau real d'Apollo no ha d'anar al Sheet. Ha d'existir com a variable d'entorn o secret segur a n8n/EasyPanel amb el nom indicat per `APOLLO_API_KEY_ENV_VAR`.

## Processament

Una fila es processa si:

- `apollo_status` esta buit;
- `apollo_status=retry`;
- `apollo_status=pending`;
- o `apollo_last_checked_at` es anterior a `RECHECK_AFTER_DAYS` i l'estat no es final.

Estats finals que el workflow no repeteix per defecte:

- `matched`
- `completed`

## Conservacio de dades manuals

Amb `OVERWRITE_EXISTING_CONTACT_DATA=false`, el workflow no substitueix camps `decision_maker_*` ni IDs Apollo que ja tinguin valor. Si Apollo retorna una dada nova pero el Sheet ja te valor manual, es conserva el valor del Sheet.
