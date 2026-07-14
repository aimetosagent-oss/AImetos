# AImetos CRM

CRM comercial intern d’AImetos construït com un monòlit modular amb Next.js, TypeScript, PostgreSQL, Prisma i Auth.js. Centralitza empreses, contactes, oportunitats, formularis públics, tasques, pressupostos, factures, pagaments i automatitzacions sortints sense dependre de Stripe, SMTP o n8n per funcionar.

Els projectes preexistents (`aimetos-content-system`, `gh-compute-pain-engine`, `dashboard` i `workflows`) continuen aïllats i no s’han modificat ni substituït.

## Requisits

- Docker Desktop amb Docker Compose, o Node.js 22+ per al desenvolupament sense Docker.
- npm 11+.
- PostgreSQL 16+ si no s’utilitza Docker. Com a alternativa local sense instal·lar PostgreSQL, Prisma inclou `prisma dev`.
- Stripe CLI només per provar webhooks Stripe.

## Arquitectura

- `src/app`: App Router, pàgines internes protegides, pàgines públiques i API.
- `src/modules`: casos d’ús de negoci (formularis, pipeline, documents, comunicacions i integracions).
- `src/worker`: worker separat que reclama jobs de PostgreSQL amb `FOR UPDATE SKIP LOCKED`.
- `prisma`: model multi-organització, migracions i seed idempotent.
- `public/brand/logo-web.png`: wordmark original d’AImetos, copiat sense transformar.
- `docs`: arquitectura, model de dades, webhooks i operació.

No hi ha Redis, microserveis ni cua externa. Les operacions d’usuari escriuen esdeveniments a l’outbox dins la mateixa transacció; el worker fa el lliurament posterior sense bloquejar l’usuari.

Més detall a [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) i [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

## Inici ràpid amb Docker

```bash
cp .env.example .env
docker compose up --build
```

Serveis:

- CRM: <http://localhost:3000>
- Mailpit: <http://localhost:8025>
- PostgreSQL: `127.0.0.1:5432`
- Worker: procés separat dins la mateixa imatge.

La composició espera que PostgreSQL estigui saludable, executa `prisma migrate deploy` en un servei d’un sol ús i després arrenca `app` i `worker`. Per crear les dades demo la primera vegada:

```bash
docker compose run --rm migrate seed
```

Aturada:

```bash
docker compose down
```

Les dades de PostgreSQL i Mailpit es conserven en volums. `docker compose down -v` les elimina; no l’utilitzis si necessites conservar-les.

## Desenvolupament sense Docker

En Windows utilitza `npm.cmd` si PowerShell bloqueja `npm.ps1`.

```bash
npm install
npm run db:dev
npm run db:reset
npm run dev
```

En un segon terminal:

```bash
npm run worker
```

`npm run db:dev` arrenca una instància PostgreSQL local de Prisma als ports `51214` (base principal) i `51215` (shadow). Com que `.env.example` està preparat per a Docker, en execució nativa copia'l a `.env` i substitueix les tres URLs per:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable&pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable&pgbouncer=true&connection_limit=1
SHADOW_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51215/template1?sslmode=disable&pgbouncer=true&connection_limit=1
```

Si utilitzes un PostgreSQL propi, adapta aquestes connexions al teu servidor.

Mailpit no està inclòs com a paquet Node. Pots arrencar només aquest servei amb Docker (`docker compose up mailpit`) o instal·lar Mailpit i exposar SMTP a `127.0.0.1:1025` i la UI a `8025`. Sense SMTP, el CRM continua funcionant i els jobs de correu queden reintentables.

## Credencials demo

- Correu: `admin@aimetos.local`
- Contrasenya: `AdminAimetos2026!`

Les variables `ADMIN_EMAIL`, `ADMIN_PASSWORD` i `ADMIN_NAME` controlen l’usuari que crea el seed. Canvia-les en qualsevol entorn compartit.

## Scripts

```text
npm run dev               servidor Next.js de desenvolupament
npm run worker            worker de recordatoris/correu/webhooks
npm run build             Prisma Client + build de producció
npm run start             servidor de producció
npm run lint              ESLint
npm run typecheck         TypeScript estricte
npm run test              tests Vitest
npm run test:unit         tests unitaris
npm run test:integration  tests amb PostgreSQL
npm run test:e2e          Playwright
npm run db:dev            PostgreSQL local de Prisma
npm run db:migrate        aplica migracions versionades
npm run db:migrate:dev    crea migracions durant desenvolupament
npm run db:seed           dades inicials/demo
npm run db:reset          reinicia la base local i executa el seed
```

## Variables d’entorn

Copia `.env.example`. No hi ha cap secret real al repositori.

Obligatòries:

- `DATABASE_URL`: connexió PostgreSQL.
- `SHADOW_DATABASE_URL`: necessària només per `prisma migrate dev`.
- `AUTH_SECRET`: mínim 32 caràcters aleatoris.
- `APP_URL`: URL pública del CRM, sense domini fix al codi.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`: seed local.

Opcionals:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_*`.
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `INTEGRATION_ENCRYPTION_KEY`: 32 bytes en base64 per xifrar secrets de webhooks sortints.
- `WORKER_ID`, `WORKER_POLL_INTERVAL_MS`, `WORKER_LOCK_TIMEOUT_MINUTES`.
- `PUBLIC_FORM_TRUSTED_PROXY_HOPS`, `AUTH_TRUSTED_PROXY_HOPS`: nombre exacte de proxies controlats; deixa'ls a `0` sense aquesta garantia de xarxa.

El CRM rebutja claus Stripe live en aquest MVP. No introdueixis secrets en variables `NEXT_PUBLIC_*`, logs o commits.

## Migracions i seed

Producció i Docker:

```bash
npm run db:migrate
```

Desenvolupament després de canviar `prisma/schema.prisma`:

```bash
npm run db:migrate:dev -- --name descripcio_del_canvi
```

Dades inicials/demo idempotents:

```bash
npm run db:seed
```

Amb `SEED_DEMO_DATA=true`, el seed crea AImetos, l’admin, el pipeline de vuit etapes, set productes, empreses/contactes/oportunitats, el formulari `/f/demanar-una-demo`, tasques i documents de mostra. Amb `SEED_DEMO_DATA=false`, només fa el bootstrap de l’organització, l’admin, el pipeline i el catàleg; és el mode per al primer desplegament real. El seed no sobreescriu la contrasenya d’un usuari admin que ja existeix.

## Tests i comprovacions

Amb PostgreSQL local actiu i el seed aplicat:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Els tests d’integració utilitzen `DATABASE_URL`. No utilitzen SQLite perquè la numeració concurrent, els locks i `SKIP LOCKED` són comportaments PostgreSQL.

## Correu i Mailpit

En Docker, l’SMTP predeterminat és `mailpit:1025`. En local és `127.0.0.1:1025`. Enviar un pressupost o factura crea primer un `EmailMessage` i un `ScheduledJob`; el worker fa l’enviament i registra l’activitat. Un error SMTP no elimina el job.

Obre <http://localhost:8025> per veure els correus. Les plantilles inclouen versions HTML i text i un enllaç públic segur al document.

## Stripe en mode test

1. Defineix només claus `sk_test_...` i `pk_test_...`.
2. Arrenca l’aplicació.
3. Inicia el reenviament local:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

4. Copia el secret `whsec_...` que mostra la CLI a `STRIPE_WEBHOOK_SECRET`.
5. Obre una factura pública i crea un Checkout de prova.

Targeta de prova habitual de Stripe: `4242 4242 4242 4242`, qualsevol data futura i qualsevol CVC. No s’emmagatzemen dades de targeta al CRM.

Els esdeveniments entrants es guarden per `stripeEventId` i els pagaments es dedupliquen per PaymentIntent/idempotency key. Els esdeveniments de subscripció es registren i vinculen, però aquest MVP no administra facturació recurrent.

## Webhooks n8n

Configura endpoints a `Configuració`. Els esdeveniments es creen amb patró outbox i es lliuren de manera asíncrona amb:

```text
X-Aimetos-Event
X-Aimetos-Event-Id
X-Aimetos-Timestamp
X-Aimetos-Signature
```

La signatura és HMAC-SHA256 de `timestamp.rawBody`. L’identificador d’esdeveniment es manté estable en els reintents perquè n8n pugui deduplicar. Consulta [docs/WEBHOOKS.md](docs/WEBHOOKS.md).

## Marca

El logotip adjunt original és a `public/brand/logo-web.png` i s’utilitza al login, la barra lateral i els documents. Mantén la proporció; no hi apliquis filtres ni substitueixis els colors. Per actualitzar-lo, copia el wordmark oficial al mateix camí i conserva el nom.

## Backup de PostgreSQL

Amb Docker:

```bash
docker compose exec -T postgres pg_dump -U aimetos -d aimetos_crm -Fc > aimetos-crm.dump
```

Restauració en una base buida:

```bash
docker compose exec -T postgres pg_restore -U aimetos -d aimetos_crm --clean --if-exists < aimetos-crm.dump
```

Prova periòdicament la restauració. Els PDFs es generen sota demanda i no requereixen backup de fitxers.

## Preparació per EasyPanel

`Dockerfile` genera la sortida standalone de Next.js i la mateixa imatge executa l’app, el worker o les migracions mitjançant `docker/entrypoint.sh`. A EasyPanel crea:

1. Un PostgreSQL persistent.
2. Un servei `migrate` d’un sol ús amb la comanda `migrate`.
3. Un servei web amb la comanda `app`, port 3000 i health check `/api/health`.
4. Un servei worker amb la comanda `worker`, sense port públic.
5. Variables i secrets d’entorn; `APP_URL` serà el futur domini del CRM.

No executis el seed amb `SEED_DEMO_DATA=true` en producció. Instruccions completes a [docs/DEPLOY_EASYPANEL.md](docs/DEPLOY_EASYPANEL.md).

## Limitacions actuals

- El constructor de formularis és per files/camps, no un canvas visual ni un sistema complet d’i18n.
- La pantalla interna de creació de documents afegeix una línia manual per operació; el model, el seed, el càlcul i els PDFs admeten múltiples línies.
- No hi ha editor ric de plantilles ni campanyes de correu.
- Les subscripcions Stripe només es registren; no hi ha gestió recurrent completa.
- No és una implementació de VeriFactu ni una solució completa de compliment fiscal espanyol.
- Un escàner d’enllaços de correu pot marcar un pressupost com a vist.
- Stripe, SMTP extern i n8n requereixen credencials i infraestructura pròpies; sense elles la resta del CRM continua operativa.
