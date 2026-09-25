# LinkedIn API setup

## Estat actual

**BLOCKER:** l'app encara no té credencials configurades ni accés confirmat al producte Community Management API. El software queda `ready-to-connect`; no es mostra cap èxit fictici.

**LINKEDIN ACTION REQUIRED:** crear o verificar l'app, associar-hi la pàgina d'AImetos i sol·licitar el Development Tier de Community Management.

**URL:** [LinkedIn Developer Portal](https://developer.linkedin.com/)

**SCOPES/PRODUCT:** Community Management API amb `r_member_postAnalytics` i `r_member_profileAnalytics`.

**AFTER APPROVAL:** amb les variables ja configurades, prémer una sola vegada **Connectar LinkedIn** al perfil Administrador tècnic.

## Matriu de capacitats

| Capacitat | Estat real | Nota |
| --- | --- | --- |
| OAuth 2.0 i registre únic URL/URN | `AVAILABLE_NOW` | Implementat al backend. |
| Analítica d'un post personal | `REQUIRES_LINKEDIN_APPROVAL` | `r_member_postAnalytics`; `memberCreatorPostAnalytics`. |
| Followers totals | `REQUIRES_LINKEDIN_APPROVAL` | `r_member_profileAnalytics`; `memberFollowersCount`. |
| Enumerar automàticament tots els posts personals | `NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS` | Requeriria `r_member_social`, que és tancat/restringit. |
| Text i comentaris dels posts personals | `NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS` | No es simulen ni es fa scraping. |
| Desglossament d'audiència per post | `NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS` | Es conserva com a dada manual opcional. |
| Visitants del perfil i aparicions en cerques | `NOT_AVAILABLE_WITH_CURRENT_PERMISSIONS` | No s'ha trobat un endpoint oficial verificable per a l'app actual. |

## 1. Developer Portal

Obre [developer.linkedin.com](https://developer.linkedin.com/), inicia sessió amb el compte administrador i entra a **My Apps**.

## 2. Crear i verificar l'app

1. Crea una app amb el nom legal d'AImetos, correu corporatiu, web i política de privacitat.
2. Completa la pestanya **Settings**.
3. Fes que un superadministrador de la pàgina associada verifiqui l'app.
4. No copiïs el `Client Secret` en cap document, captura, xat, frontend o commit.

La revisió exigeix una organització legal identificable i una app verificada per la pàgina associada. Consulta la [guia oficial d'App Review](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2025-11).

## 3. Pàgina que s'ha d'associar

Associa la pàgina corporativa oficial **AImetos**. Roger o la persona que verifiqui l'app ha de ser-ne superadministrador. Si encara no existeix una pàgina corporativa AImetos, cal crear-la abans de completar la verificació; no s'ha d'associar una pàgina aliena només per superar el procés.

## 4. Community Management Development Tier

A **Products**, sol·licita **Community Management API** en Development Tier. Aquest tier permet provar el flux, però aplica límits de 500 crides per app i dia, 100 per membre i dia, sense batch GET ni webhooks. El sistema reserva marge i utilitza per defecte un màxim de 90 crides diàries per membre. Fonts: [Community Management overview](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview?view=li-lms-2026-06) i [Increasing access](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-08).

## 5. Scopes requerits

Demana només:

- `r_member_postAnalytics`: mètriques dels posts personals.
- `r_member_profileAnalytics`: recompte de followers del membre.

No es demana `w_member_social`, perquè el PAS 3 no publica. No es pressuposa `r_member_social`: actualment és un permís tancat. Els scopes només apareixeran a OAuth quan LinkedIn aprovi el producte corresponent.

## 6. Redirect URL exacta

Configura a **Auth > Authorized redirect URLs for your app** exactament el mateix valor que `LINKEDIN_REDIRECT_URI`.

- Local: `http://127.0.0.1:4317/api/linkedin/oauth/callback`
- Producció: `https://DOMINI_DEL_DASHBOARD/api/linkedin/oauth/callback`

El domini de producció no s'ha d'inventar ni substituir pel domini d'n8n. Quan el dashboard es publiqui a EasyPanel, usa el seu domini HTTPS definitiu i copia literalment aquesta URL també a l'ENV.

## 7. Variables ENV

```dotenv
LINKEDIN_ENABLED=true
LINKEDIN_SYNC_ENABLED=true
LINKEDIN_STORAGE=postgres
LINKEDIN_FIXTURE_MODE=false
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://DOMINI_DEL_DASHBOARD/api/linkedin/oauth/callback
LINKEDIN_API_VERSION=202609
LINKEDIN_TOKEN_ENCRYPTION_KEY=
LINKEDIN_MAX_CALLS_PER_DAY=90
LINKEDIN_SYNC_INTERVAL_MS=21600000
```

Genera `LINKEDIN_TOKEN_ENCRYPTION_KEY` com 32 bytes aleatoris codificats en base64. No la regeneris després de connectar, perquè deixaria els tokens existents indesxifrables. Els tokens es guarden amb AES-256-GCM i mai es retornen al navegador o als logs.

## 8. On configurar-les

- Local: fitxer `.env` a l'arrel del repositori; està ignorat per Git.
- EasyPanel: projecte AImetos → servei de l'API → **Environment**. Afegeix-hi les variables anteriors i les mateixes al servei worker. Després fes redeploy dels dos serveis.
- Executa `pnpm db:migrate` contra el PostgreSQL de l'entorn abans del primer connect.

## 9. Connectar el compte

1. Entra al dashboard amb el perfil **Administrador tècnic**.
2. Obre **Ingestió automàtica LinkedIn**.
3. Prem **Connectar LinkedIn**.
4. Autoritza els dos scopes.
5. Per cada post que el sistema no pugui descobrir oficialment, registra una sola vegada la URL i, si cal, la seva URN oficial.

No s'utilitzen cookies, scraping ni automatització del navegador.

## 10. Verificar que funciona

1. `GET /api/linkedin/status` ha de mostrar `connected` i els dos scopes sense revelar tokens.
2. Registra un post conegut amb `POST /api/linkedin/posts`.
3. Prem **Sincronitzar ara** o executa `POST /api/linkedin/sync`.
4. Comprova que el run és `ok`, que `snapshotsCreated` és com a mínim 1 i que `lastSync` canvia.
5. Executa el sync una segona vegada: amb les mateixes dades no ha de duplicar el snapshot.
6. Obre `/api/client-report` i comprova que `dataStates` inclou `linkedin_api`.

## 11. Permisos pendents

Mentre LinkedIn no hagi aprovat Community Management, el dashboard mostrarà `AWAITING LINKEDIN APPROVAL`. Un `403` oficial també canvia l'estat a `awaiting_approval`; no s'interpreta com una connexió correcta.

## 12. Dades que no s'obtenen oficialment ara

No s'implementen sense endpoint i permís oficial verificat:

- enumeració de tots els posts personals;
- text i comentaris dels posts personals;
- càrrec, seniority, ubicació, mida d'empresa, sector o empresa per post;
- llista de visitants del perfil;
- aparicions en cerques.

La URL/URN es registra una sola vegada quan cal. Després, impressions, abast, reaccions, comentaris, comparticions, guardats, enviaments, followers guanyats, visites al perfil des del contingut i clics s'actualitzen per API. Les mètriques oficials són best-effort i poden diferir de la UI: [Member Post Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2026-09) i [Member Follower Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/follower-statistics?view=li-lms-2026-07).

## 13. Passar a Standard Tier

Quan el flux real funcioni en Development Tier:

1. Recull un screencast del connect, registre del post, sync i ús de les dades al dashboard.
2. Torna a **Products > Community Management API**.
3. Sol·licita Standard Tier i completa l'App Review amb el cas d'ús real, política de privacitat i prova visual.
4. Mantén els mateixos mínims scopes.
5. Revisa `LINKEDIN_API_VERSION` mensualment. LinkedIn publica versions `YYYYMM` i les suporta com a mínim un any: [Versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-06).

## Operació i errors

- `401`: token caducat; el dashboard demana **Reconnectar** i conserva totes les dades.
- `403`: approval/scope absent; estat `awaiting_approval`.
- `429` o `5xx`: reintents curts i controlats; no es dupliquen snapshots.
- El scheduler prioritza milestones de 24 h, 72 h i 7 dies; no repassa inútilment tots els posts antics.
- OAuth oficial: [3-legged authorization code flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).
