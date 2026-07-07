# Setup des de zero

1. Crea un projecte nou a Google Apps Script.
2. Copia `apps-script/Code.gs`.
3. Executa `setupGhComputeLeadEngine`.
4. Obre el full `GH Compute Lead Engine`.
5. Copia l'ID del full des de la URL: el valor entre `/d/` i `/edit` és `GOOGLE_SHEET_ID`.
6. Entra a EasyPanel o al panell del servei n8n.
7. Configura aquestes variables d'entorn:

```bash
TZ=Europe/Madrid
GOOGLE_SHEET_ID=
APIFY_TOKEN=
APIFY_TOKEN_CLIENT_A=
APIFY_TOKEN_CLIENT_B=
OPENAI_API_KEY=
OPENAI_MODEL=
APOLLO_API_KEY=
APOLLO_ENRICH_ENDPOINT=
N8N_EDITOR_BASE_URL=
```

8. Deixa `APOLLO_API_KEY` i `APOLLO_ENRICH_ENDPOINT` buides si no faràs servir Apollo.
9. Reinicia n8n només després de canviar variables d'entorn.
10. A n8n, crea o verifica la credencial OAuth de Google Sheets.
11. Crea les Apify Tasks necessàries.
12. Executa cada Apify Task manualment una vegada.
13. Copia cada Task ID a `00_CONFIG.APIFY_SOURCES_JSON`.
14. Si una font Apify ha d'usar un compte autoritzat diferent, posa només el nom de variable a `apify_token_env_var`, per exemple `APIFY_TOKEN_CLIENT_A`.
15. Ajusta `input_template` perquè coincideixi amb els camps reals de la Task seleccionada.
16. Importa `04-gh-compute-error-handler.json`.
17. Assigna `GH Compute — Error Handler` com a workflow global d'errors.
18. Importa `01-gh-compute-pain-detector.json`.
19. Importa `02-gh-compute-apollo-enrichment.json`.
20. Importa `03-gh-compute-outreach-drafts.json`.
21. Executa manualment `GH Compute — Pain Detector`.
22. Revisa `04_RUN_LOG`.
23. Revisa `02_PAIN_SIGNALS`.
24. Revisa `03_LEADS_CUALIFICADOS`.

Cap API key pot aparèixer als exports de workflow, Apps Script, documentació d'exemple o fixtures de test. Tots els secrets van a variables d'entorn del servei n8n.
