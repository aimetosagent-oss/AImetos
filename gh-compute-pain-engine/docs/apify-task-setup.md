# Configuració d'Apify Tasks

1. Entra a Apify.
2. Tria un actor adequat per fonts públiques: cerca web, pàgines públiques o ofertes de feina públiques.
3. Crea una Task a partir de l'actor.
4. Defineix un input de prova.
5. Executa la Task manualment.
6. Obre el dataset i verifica que hi ha `title`, `url`, `text`, `description`, `snippet`, `jobTitle`, `company`, `companyName` o camps equivalents.
7. Copia el Task ID.
8. Obre `00_CONFIG.APIFY_SOURCES_JSON`.
9. Substitueix `REPLACE_WITH_APIFY_TASK_ID` pel Task ID.
10. Posa a `apify_token_env_var` el nom de la variable d'entorn que conté el token autoritzat per aquella Task, per exemple `APIFY_TOKEN`.
11. Ajusta `input_template` als noms exactes que espera la Task.
12. Mantén `enabled` a `false` fins que la prova manual sigui correcta.
13. Canvia `enabled` a `true` només després de verificar el dataset.

## Substitució de plantilles

El workflow substitueix de forma recursiva:

- `{{query}}`
- `{{country}}`
- `{{countryCode}}`

Això funciona dins d'objectes i arrays del `input_template`.

## Exemple de cerca Google

```json
{
  "id": "google_search",
  "enabled": true,
  "task_id": "REPLACE_WITH_APIFY_TASK_ID",
  "apify_token_env_var": "APIFY_TOKEN",
  "result_type": "web_search",
  "input_template": {
    "queries": "{{query}}",
    "resultsPerPage": 10,
    "maxPagesPerQuery": 1,
    "languageCode": "en",
    "countryCode": "{{countryCode}}"
  }
}
```

## Exemple opcional de jobs

```json
{
  "id": "jobs",
  "enabled": false,
  "task_id": "REPLACE_WITH_APIFY_TASK_ID",
  "apify_token_env_var": "APIFY_TOKEN_CLIENT_A",
  "result_type": "jobs",
  "input_template": {
    "query": "{{query}}",
    "location": "{{country}}",
    "maxResults": 20
  }
}
```

Els noms dels camps del `input_template` han de coincidir amb la Task seleccionada. Si la Task espera `search`, no facis servir `query`; si espera `locationQuery`, no facis servir `location`.

No guardis tokens Apify a Google Sheets. Si Apify retorna `402 Payment required`, revisa el compte o desactiva la font; el workflow ho ha de registrar com a incidència de compte, no saltar automàticament a un altre compte per evitar límits.
