# GH Compute Lead Engine

Sistema d'intel·ligència comercial per detectar empreses amb senyals públiques de dolor operatiu relacionat amb Rhino, Grasshopper, disseny paramètric, computació geomètrica, optimització, simulació, generació de variants i automatització d'entregables.

El servei validat és: `Ejecución externalizada de definiciones pesadas y automatización de variantes y entregables para equipos que trabajan con Rhino y Grasshopper`.

## 1. Què fa

- Cerca senyals públiques amb Apify Tasks configurables.
- Normalitza resultats de cerca, llocs web i ofertes de feina.
- Classifica dolor amb OpenAI i sortida JSON estricta.
- Puntua cada senyal amb lògica determinista dins n8n.
- Desa empreses, senyals, leads qualificats, logs i esborranys a Google Sheets.
- Deixa Sales Navigator, LinkedIn i email com a passos manuals revisats per una persona.

## 2. Què no fa

- No ven cloud computing, HPC, servidors, GPU rental ni outsourcing IT.
- No automatitza LinkedIn.
- No scrapeja perfils de LinkedIn amb sessió iniciada.
- No envia emails automàtics.
- No crea missatges sortints sense revisió humana.
- No requereix Apollo per al flux principal.

## 3. Mapa de carpetes

- `apps-script/`: script idempotent per crear i configurar `GH Compute Lead Engine`.
- `config/`: JSON inicial de consultes i fonts Apify.
- `docs/`: guies de posada en marxa, operació, Apify, Sales Navigator, privacitat i resolució d'errors.
- `n8n/workflows/`: quatre workflows importables i desactivats.
- `prompts/`: prompts i esquemes JSON per OpenAI.
- `tests/`: validació local amb Node.js sense dependències externes.
- `scripts/`: comanda agregada de validació.

## 4. Ordre exacte d'implementació

1. Executa `apps-script/Code.gs` amb `setupGhComputeLeadEngine`.
2. Copia el `GOOGLE_SHEET_ID`.
3. Configura variables d'entorn a EasyPanel / servei n8n.
4. Reinicia n8n després de canviar variables.
5. Configura les credencials OAuth de Google Sheets a n8n.
6. Crea i prova manualment les Apify Tasks.
7. Substitueix els `task_id` a `00_CONFIG.APIFY_SOURCES_JSON`.
8. Importa els workflows en l'ordre indicat.
9. Executa el workflow 01 manualment una vegada.
10. Revisa `04_RUN_LOG`, `02_PAIN_SIGNALS` i `03_LEADS_CUALIFICADOS`.

## 5. Ordre exacte d'importació a n8n

1. `04-gh-compute-error-handler.json`
2. `01-gh-compute-pain-detector.json`
3. `02-gh-compute-apollo-enrichment.json`
4. `03-gh-compute-outreach-drafts.json`

Després d'importar, mantén-los desactivats fins que les variables i credencials estiguin configurades.

## 6. Mapa de credencials

| Integració | On es configura | Ús |
| --- | --- | --- |
| Google Sheets OAuth | Credencial n8n | Llegir i escriure al spreadsheet |
| `APIFY_TOKEN` | Entorn n8n | Executar Apify Tasks i llegir datasets |
| `APIFY_TOKEN_CLIENT_A` | Entorn n8n | Token Apify opcional per una font autoritzada alternativa |
| `APIFY_TOKEN_CLIENT_B` | Entorn n8n | Token Apify opcional per una altra font autoritzada |
| `OPENAI_API_KEY` | Entorn n8n | Classificació i esborranys |
| `APOLLO_API_KEY` | Entorn n8n | Només workflow 02 opcional |

## 7. Variables d'entorn

Configura exactament aquestes variables al servei n8n:

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

`APOLLO_API_KEY` i `APOLLO_ENRICH_ENDPOINT` poden quedar buides. El flux principal continua operatiu.

## 8. Google Apps Script

`apps-script/Code.gs` crea el full `GH Compute Lead Engine`, les sis pestanyes, capçaleres, validacions, filtres, files congelades, format bàsic i valors de `00_CONFIG`. El script és idempotent i no elimina dades existents.

## 9. Apify Task setup

Les fonts Apify es defineixen només a `00_CONFIG.APIFY_SOURCES_JSON`. Cada font té `id`, `enabled`, `task_id`, `apify_token_env_var`, `result_type` i `input_template`. El valor `apify_token_env_var` és el nom d'una variable d'entorn, no el token. El workflow fa substitució recursiva de `{{query}}`, `{{country}}` i `{{countryCode}}`.

## 10. Procés de test

Executa:

```bash
npm run validate
npm test
```

Els tests comproven JSON importable, nodes estàndard, connexions, prompts, capçaleres d'Apps Script, puntuació, normalització, aïllament d'Apollo i absència de secrets.

## 11. Primera execució en producció

1. Activa només `GH Compute — Pain Detector`.
2. Executa'l manualment.
3. Revisa `04_RUN_LOG`.
4. Obre `02_PAIN_SIGNALS` i verifica evidència.
5. Obre `03_LEADS_CUALIFICADOS` i revisa només prioritats A i B.
6. Usa Sales Navigator manualment per afegir decisor.
7. Marca el lead com `Validated`.
8. Executa manualment `GH Compute — Outreach Drafts`.
9. Revisa i envia manualment fora de n8n.

## 12. Apollo enable/disable

Per defecte Apollo està desactivat amb `APOLLO_ENABLED=FALSE` a `00_CONFIG`. Per activar-lo cal posar `APOLLO_ENABLED` exactament a `TRUE`, configurar `APOLLO_API_KEY`, configurar `APOLLO_ENRICH_ENDPOINT` i executar o programar el workflow 02. Si falta qualsevol condició, el workflow registra `Skipped` i no modifica el pipeline principal.

## 13. Límits operatius

- Prioritza poques empreses qualificades.
- Revisa leads A en menys de 24 hores.
- No contactis leads C.
- No canviïs codi del workflow per arreglar una font Apify trencada; desactiva la font a `00_CONFIG`.
- No guardis secrets a Google Sheets ni en fitxers.
- No activis sortida automàtica.
