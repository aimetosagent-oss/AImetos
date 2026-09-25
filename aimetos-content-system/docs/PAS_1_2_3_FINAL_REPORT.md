# Informe final PAS 1, PAS 2 i PAS 3

## 1. PAS 1: handoff guardat

El handoff incremental queda preservat a `docs/CONTENT_INTELLIGENCE_INCREMENTAL_2026-09-24.md`. No s'ha reconstruït ni alterat el context editorial.

## 2. PAS 2: Content Decision Engine

La lògica determinista, l'estat editorial, el debat amb OpenAI, el control humà d'aprovar/rebutjar i el fallback local continuen actius. El PAS 3 reutilitza aquests serveis i no dispara OpenAI cada vegada que entra una mètrica.

## 3. PAS 3: LinkedIn ready-to-connect

Implementat sota el CAS B, perquè l'entorn no té credencials ni approval confirmat:

- OAuth 2.0 3-legged amb `state` d'un sol ús.
- Tokens xifrats AES-256-GCM en repòs.
- Client oficial versionat per `memberCreatorPostAnalytics` i `memberFollowersCount`.
- Registre únic URL/URN sense inferir relacions no documentades.
- Backfill no destructiu de l'històric com `manual_export`.
- Snapshots oficials separats com `linkedin_api`, amb raw payload i normalització.
- Sync idempotent i milestones 24 h, 72 h i 7 dies.
- Pressupost de crides, reintents, errors i runs auditables.
- Scheduler al worker existent.
- Injecció directa dels snapshots a `buildEditorialState()` i al Decision Engine.
- Estat mínim al perfil Administrador tècnic.

## Migració

`0003_linkedin_ingestion` crea, sense eliminar dades, les taules `LinkedInAccount`, `LinkedInOAuthState`, `LinkedInPost`, `LinkedInPostSnapshot`, `LinkedInProfileSnapshot`, `LinkedInSyncRun` i `LinkedInApiError`.

`pnpm db:migrate` valida totes les migracions sense DB i les aplica transaccionalment quan existeix `DATABASE_URL`.

## Endpoints

- `GET /api/linkedin/connect`
- `GET /api/linkedin/oauth/callback`
- `POST /api/linkedin/disconnect`
- `GET /api/linkedin/status`
- `GET|POST /api/linkedin/posts`
- `POST /api/linkedin/sync`

## Variables

Contracte complet a `.env.example`: client ID/secret, redirect URI, API version, sync, storage, fixture mode, clau de xifrat, pressupost i interval.

## Proves

`tests/unit/linkedin-ingestion.test.ts` cobreix els cinc acceptance tests, parser URL/URN i versió API. Les fixtures són a `data/fixtures/linkedin-api/`.

## Execució

```bash
pnpm db:migrate
pnpm test:all
pnpm build
pnpm dev
```

Per activar el worker: `LINKEDIN_SYNC_ENABLED=true` i `node apps/worker/src/run.ts`.

## Bloqueig extern

**BLOCKER:** falta Community Management API Development Tier i les credencials/approval reals.

**LINKEDIN ACTION REQUIRED:** crear/verificar l'app, associar la pàgina AImetos i sol·licitar el producte.

**URL:** https://developer.linkedin.com/

**SCOPES/PRODUCT:** Community Management API, `r_member_postAnalytics`, `r_member_profileAnalytics`.

**AFTER APPROVAL:** configurar les ENV i prémer una vegada **Connectar LinkedIn**.

La guia operativa exacta és `docs/LINKEDIN_API_SETUP.md`.
