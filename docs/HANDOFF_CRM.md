# Traspàs de treball — AImetos CRM

Actualitzat el 14 de juliol de 2026. Aquest document permet reprendre el treball
des d'un altre ordinador sense dependre de l'historial de la conversa.

## Estat actual

El CRM comercial d'AImetos està implementat com un monòlit modular amb Next.js
16, React 19, TypeScript, PostgreSQL, Prisma 6 i Auth.js. Inclou:

- empreses, contactes, oportunitats i pipeline Kanban;
- formularis públics, deduplicació i creació automàtica de lead/oportunitat;
- tasques, productes i activitat;
- pressupostos, acceptació/rebuig públic, factures i pagaments;
- PDFs Unicode i multipàgina amb el logotip original;
- worker PostgreSQL, correu SMTP, Mailpit, outbox i webhooks sortints;
- Stripe opcional i restringit al mode test;
- aïllament multi-tenant, auditoria, rate limiting i idempotència;
- Docker Compose, Dockerfile i guia de desplegament EasyPanel.

El logotip està versionat a `public/brand/logo-web.png` i coincideix byte per
byte amb l'original lliurat.

## Validació completada

- ESLint: correcte.
- TypeScript estricte: correcte.
- Build Next.js de producció: correcte.
- Unit tests: 43/43.
- Integration tests amb PostgreSQL: 23/23.
- Playwright E2E: 2/2 fluxos crítics.
- Migracions i seed: correctes.
- PDF de sis pàgines: renderitzat i revisat visualment.
- Worker i enviament SMTP real cap a Mailpit: validats.
- Esquema Prisma i `git diff --check`: correctes.

Docker no estava instal·lat a l'ordinador d'origen; el build de la imatge i el
desplegament EasyPanel encara s'han de provar en una màquina amb Docker.

## Fitxers importants

- `README.md`: instal·lació, scripts, arquitectura i limitacions.
- `.env.example`: variables sense secrets.
- `prisma/schema.prisma`: model complet.
- `prisma/migrations/`: migracions versionades.
- `prisma/seed.ts`: bootstrap i dades demo.
- `docs/ARCHITECTURE.md`: arquitectura.
- `docs/DATA_MODEL.md`: model de dades.
- `docs/LOCAL_DEVELOPMENT.md`: desenvolupament local.
- `docs/DEPLOY_EASYPANEL.md`: desplegament futur.
- `docs/WEBHOOKS.md`: contracte de webhooks.

## Què no viatja amb Git

No cal copiar `node_modules`, `.next`, `tmp`, informes Playwright ni la base de
dades local. Estan ignorats i es poden reconstruir.

El fitxer `.env` també està ignorat perquè pot contenir secrets. A l'altre
ordinador cal crear-lo a partir de `.env.example` i definir almenys les URLs de
PostgreSQL i un `AUTH_SECRET` propi. No enganxar secrets a aquest document.

La base demo es reconstrueix amb les migracions i el seed. Credencials demo:

- usuari: `admin@aimetos.local`
- contrasenya: `AdminAimetos2026!`

Cal canviar-les en qualsevol entorn compartit o real.

## Represa en un altre ordinador

Després de clonar o actualitzar `main`:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run db:dev
npm.cmd run db:reset
npm.cmd run dev
```

En un segon terminal:

```powershell
npm.cmd run worker
```

Si el port 3000 està ocupat, establir `APP_URL=http://localhost:3100` a `.env`
i executar `npm.cmd run dev -- --port 3100`.

Comprovació recomanada després de preparar l'entorn:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run build
npm.cmd run test:e2e
```

## Decisions i precaucions

- No activar claus Stripe live: aquest MVP només accepta `sk_test_`/`pk_test_`.
- Sense `SMTP_HOST`, els correus fallen de manera reintentable; no es marquen
  falsament com enviats.
- Per al bootstrap real usar `SEED_DEMO_DATA=false`.
- El seed no sobreescriu la contrasenya d'un admin ja existent.
- Els formularis públics limiten mida, camps i intents, i utilitzen `requestId`
  idempotent.
- Els pagaments i decisions de pressupost estan protegits contra concurrència.
- No és una implementació completa de VeriFactu.

## Abans de canviar d'ordinador

En el moment de crear aquest document, el CRM encara apareix com a canvis nous
o modificats sense commit. El procés d'“acabar” ha de fer, com a mínim:

```powershell
git add .
git commit -m "Add AImetos CRM MVP"
git push origin main
```

Abans d'apagar, comprovar que `git status` no mostra canvis pendents i que el
commit és visible al remot `https://github.com/aimetosagent-oss/AImetos.git`.

