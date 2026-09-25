# Traspàs de treball — AImetos CRM

Actualitzat el 12 d'agost de 2026. Aquest document permet reprendre el treball
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

## Migració inicial des de GoHighLevel

El 9 d'agost de 2026 s'ha incorporat la primera configuració real d'AImetos:

- pipeline `Embudo Clientes` amb les dotze etapes facilitades, des de `Nuevo Lead` fins a `No cualificado / perdido`;
- pressupostos amb numeració diària `PRE-AAMMDD-01`;
- factures amb numeració diària `FAC-AAMMDD-01`;
- seqüències independents per tipus de document i dia, calculades amb la zona horària de l'organització;
- quatre formularis públics equivalents als formularis de les pàgines de serveis: atenció 24/7, reserves, qualificació de leads i integració total;
- camps de resposta única i selecció múltiple, dades de contacte, empresa, càrrec i sector;
- creació automàtica de contacte, empresa, lead, oportunitat i tasca de seguiment;
- webhooks desactivats per defecte.

Els formularis nous queden disponibles al CRM amb aquests identificadors:

- `/f/atencion-automatizada-24-7`
- `/f/reservas-automatizadas`
- `/f/cualificacion-de-leads`
- `/f/integracion-total`

La validació local del 12 d'agost de 2026 ha completat:

- instal·lació exacta des de `package-lock.json`;
- `prisma format`, generació del client i validació de l'esquema;
- aplicació correcta de les tres migracions sobre PostgreSQL local;
- seed verificat amb 12 etapes, 4 formularis de servei i documents
  `PRE-260812-01` / `FAC-260812-01`;
- `73/73` tests, typecheck i build de producció correctes;
- lint sense errors i amb un únic avís preexistent a
  `workflows/apollo/Apollo_buscar_i_enriquir_NODE_COMPLET.js`;
- comprovació al navegador del login, dashboard, pipeline, formularis,
  pressupostos, factures i configuració;
- comprovació responsive dels quatre formularis i el pipeline. Les capçaleres
  llargues del pipeline ara fan salt de línia sense quedar truncades.

El fitxer `opportunities.csv` contenia 5 oportunitats. La importació definitiva
del 12 d'agost ha descartat les dues proves de Roger Arnau i ha incorporat:

- Ramon Figueras Alsius, empresa `La Cabina`, a `Asistio a Llamada - Interes medio`;
- Jordi Olivé Currius, sense empresa perquè és autònom, a `Asistio a Llamada - Interes bajo`;
- Víctor Gutiérrez Parron, empresa `Saló Guttié`, a `Presupuesto enviado`.

La importació és idempotent i es pot repetir amb
`npm run import:ghl-opportunities -- <ruta-al-csv>` sense duplicar contactes,
empreses, oportunitats ni notes.

També s'ha carregat el catàleg comercial del document de Drive
`AImetos – Estructura Comercial (Intern)`: setup general, sis packs, extensió
multilingüe, tres manteniments, dos escalats per volum i sis membresies. Hi ha
20 productes actius en total.

Les dades fiscals configurades són `Roger Arnau Bach`, NIF `45646645V`,
`C/ Soler i Palet 15`, `08222 Terrassa`.

Els PDF es lliuren amb el número del document com a nom de fitxer, per exemple
`FAC-260812-01.pdf` i `PRE-260812-01.pdf`.

Continua pendent substituir els iframes de GoHighLevel a la web i definir els
textos exactes dels correus/SMS de les automatitzacions.

## Domini de correu, enllaços i pagaments

`mail.aimetos.com` està configurat a GoHighLevel com a domini dedicat de correu
de LeadConnector. S'ha de conservar per a l'enviament. La recomanació per als
enllaços públics del CRM, formularis, pàgines de gràcies, pressupostos i factures
és un subdomini separat com `crm.aimetos.com`; aquest valor es configura a
`APP_URL` i els correus generen els enllaços a partir d'aquesta variable.

La factura pública ja admet pagament amb Stripe en mode test. Quan
`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i
`STRIPE_WEBHOOK_SECRET` estiguin configurats, la pàgina pública de la factura
mostra el botó de pagament. No s'han activat claus live.

El CRM registra correus pendents, enviats i fallits. Les mètriques de lliurament,
obertura, clic, rebot i baixa requereixen els esdeveniments del proveïdor de
correu via API/webhook; no s'ha activat aquesta integració perquè els webhooks
continuen ajornats.

## Estat de Git i bloquejos pendents

El CRM MVP continua visible al remot
`https://github.com/aimetosagent-oss/AImetos.git`. Els canvis de migració des de
GoHighLevel descrits a l'apartat anterior són locals i encara no s'han publicat.

En aquesta màquina s'utilitza el runtime Node agrupat amb Codex i `prisma dev`
com a PostgreSQL local. Docker continua sense estar instal·lat. El desplegament
EasyPanel i `docker compose build` queden pendents d'una màquina amb Docker o
de l'accés al panell de desplegament.

