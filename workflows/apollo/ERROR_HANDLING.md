# Error handling

El workflow controla errors per fila. Una fallada no atura la resta de files del lot.

## Estats permesos

- `pending`
- `processing`
- `matched`
- `matched_without_email`
- `no_person_found`
- `insufficient_company_data`
- `api_error`
- `rate_limited`
- `credit_exhausted`
- `retry`
- `skipped`
- `completed`

## Classificacio

| Error | Estat |
| --- | --- |
| Sense domini, web o nom+ciutat | `insufficient_company_data` |
| Apollo sense resultats validats | `no_person_found` |
| 400 | `api_error` |
| 401 / 403 | `api_error` amb nota de credencial, master key o scope |
| 404 | `api_error` |
| 409 | `api_error` |
| 422 | `api_error` |
| 429 | `rate_limited` |
| Missatge de credits/saldo/quota | `credit_exhausted` |
| 5xx | `api_error` |
| Timeout | `api_error` |

## Reintents

El node de codi d'Apollo reintenta nomes:

- 429;
- timeouts;
- 5xx temporals.

Maxim:

- 2 reintents per request;
- espera exponencial limitada;
- respecta `Retry-After` quan Apollo el retorna;
- sense bucles infinits.

## Logs i privacitat

No es guarda el cos complet de les respostes Apollo al Sheet. `apollo_error` conserva nomes un diagnostic curt. Evita enganxar respostes completes amb dades personals a tickets o logs.
