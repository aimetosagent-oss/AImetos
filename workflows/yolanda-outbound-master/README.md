# YOLANDA — OUTBOUND MASTER

Paquet local de cinc workflows n8n independents. Tots s’han generat amb `active: false`, sense credencials incrustades i sense escriure mai la columna `id` del Google Sheet.

## Workflows

1. `01_import_apify_datasets.json`
   - Llegeix només campanyes `active` amb `source_type=apify`.
   - Importa registres nous dels datasets d’Apify de Mítica i Nomad.
   - Deduplica per email o per web + empresa + ciutat.

2. `02_enrich_apollo_leads.json`
   - Llegeix només campanyes `active` amb `source_type=apollo`.
   - Utilitza `apollo_roles` del Sheet per cercar una persona a partir del domini del lead.
   - Enriqueix la mateixa fila; no duplica el lead ni toca `id`.

3. `03_verify_emails_neverbounce.json`
   - Processa només campanyes actives que exigeixen verificació.
   - Només `valid` queda com `ready_to_send`.
   - `invalid`, `unknown`, `disposable` i `catch_all` queden bloquejats.
   - Un `error` és terminal. Per reintentar manualment, posar `email_verification_status=retry`.

4. `04_push_verified_leads_to_instantly.json`
   - Només envia files amb email `valid`, `outreach_status=ready_to_send` i sense `platform_lead_id`.
   - No s’executa per una campanya amb `platform_campaign_id` buit o `PENDING`.
   - Instantly continua controlant seqüència, warm-up i límits d’enviament.

5. `05_instantly_events_to_sheet_ghl.json`
   - Rep webhooks d’Instantly.
   - Actualitza estat, resposta, rebot, baixa i reunió al full correcte.
   - Crea o actualitza el contacte a GHL només en esdeveniments comercials rellevants.

El futur workflow `99` no s’ha creat. Els cinc JSON ja guarden totes les execucions amb error; quan existeixi el `99`, només caldrà seleccionar-lo com a **Error Workflow** als Settings de cadascun.

## Ordre d’importació

1. Importar els cinc JSON a n8n.
2. No activar-los encara.
3. A cada node de Google Sheets, seleccionar la credencial de Google de Yolanda.
4. Completar només aquests valors als nodes `SET — CONFIG`:
   - Workflow 01: `APIFY_DATASET_ID_MITICA` i `APIFY_DATASET_ID_NOMAD`.
   - Workflow 05: `GHL_LOCATION_ID_YOLANDA`.
   - `GOOGLE_SHEET_ID` i `CONFIG_SHEET_NAME` ja apunten al master actual.
5. Afegir les variables d’entorn d’Easypanel descrites a `.env.easypanel.example` i reiniciar/redeployar el servei n8n.
6. Executar manualment 01, 02, 03 i 04 en aquest ordre.
7. Verificar una única campanya de prova abans d’activar els Schedule Triggers.

## Variables d’Easypanel

Afegir-les al servei que executa n8n, a **Environment**, sense cometes ni espais finals:

- `APIFY_API_TOKEN_YOLANDA`
- `APOLLO_API_KEY_YOLANDA`
- `NEVERBOUNCE_API_KEY_YOLANDA`
- `INSTANTLY_API_KEY_YOLANDA`
- `INSTANTLY_WEBHOOK_SECRET_YOLANDA`
- `GHL_PRIVATE_INTEGRATION_TOKEN_YOLANDA`
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`

Els secrets no van ni al Sheet ni al node `SET — CONFIG`. El Sheet només conté control operatiu. El `SET — CONFIG` només conté identificadors d’implementació reutilitzats per diversos nodes.

## GHL: credencial i identificadors de Yolanda

Al subcompte de Yolanda de GoHighLevel:

1. Anar a **Settings → Private Integrations**.
2. Crear una integració anomenada `n8n — Yolanda — Outbound`.
3. Donar-li únicament el permís `contacts.write`.
4. Copiar el token una sola vegada i guardar-lo a Easypanel com `GHL_PRIVATE_INTEGRATION_TOKEN_YOLANDA`.
5. Copiar el Location ID del subcompte de Yolanda i posar-lo al `SET — CONFIG` del workflow 05 com `GHL_LOCATION_ID_YOLANDA`.

Ara no cal cap Calendar ID, Pipeline ID ni Stage ID: cap workflow actual crea cites ni oportunitats. Quan existeixi aquesta funció, utilitzar noms explícits, per exemple:

- `GHL_CALENDAR_ID_YOLANDA_DISCOVERY`
- `GHL_PIPELINE_ID_YOLANDA_SALES`
- `GHL_STAGE_ID_YOLANDA_NEW_REPLY`

No s’han d’afegir abans que un workflow els utilitzi.

## Webhook d’Instantly

1. Importar i activar el workflow 05.
2. Copiar la Production URL del node `Instantly Webhook`.
3. Crear el webhook a Instantly per als esdeveniments d’enviament, resposta, rebot, baixa, interès i reunió.
4. Afegir el header personalitzat `X-Yolanda-Webhook-Secret` amb exactament el mateix valor que `INSTANTLY_WEBHOOK_SECRET_YOLANDA` a Easypanel.

## Comportament segur

- `active` i els límits es gestionen exclusivament a `CONFIG_CAMPAIGNS`.
- Les campanyes inactives no processen res.
- `PENDING` bloqueja l’alta a Instantly.
- Un error de lead queda visible a la seva fila i no es reintenta infinitament.
- Els errors globals de configuració o credencial queden com a execució fallida de n8n, preparada per al futur workflow 99.
- El workflow 01 importa datasets existents d’Apify; no llança Actors o Tasks perquè no s’han definit els seus IDs ni inputs.

## Validació local executada

`validate-workflows.mjs` comprova:

- JSON vàlid;
- sintaxi JavaScript de tots els Code nodes;
- nodes i connexions existents;
- columnes de match als updates;
- absència de credencials incrustades;
- absència d’escriptura sobre la columna `id`;
- tots els triggers passen primer per `SET — CONFIG`.

La validació local no consumeix crèdits ni fa crides reals a Google, Apify, Apollo, NeverBounce, Instantly o GHL.
