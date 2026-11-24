# Traspàs de treball — AImetos CRM

Actualitzat el 24 de novembre de 2026. Aquest document permet reprendre el treball
des d'un altre ordinador sense dependre de l'historial de la conversa.

## Estat actual

### Punt exacte de represa del desplegament

Estat **PARTIAL**. Branca `codex/crm-production`, commit publicat
`7e7bb669a3543f6bbbe525ff839ecf1fa553f567`. No hi ha cap commit desplegat encara.
El 24/11 s'han desat a EasyPanel la font GitHub `aimetosagent-oss/AImetos`,
branca `codex/crm-production`, context `/` i builder `Dockerfile` als serveis
crm-app i crm-worker. Ordre del worker desada: `worker`; l'app usa CMD `app`.
Les dues configuracions Entorno contenen la plantilla de produccio, encara
amb placeholders a AUTH_SECRET, DATABASE_URL, DIRECT_DATABASE_URL i ADMIN_PASSWORD.
No s'ha clicat Implementar ni executat migracions/bootstrap al VPS.

EasyPanel ha creat dominis automatics per als dos serveis. Encara no s'han
eliminat; abans de desplegar cal retirar-los des de Dominios de cada servei.
No hi ha processos d'app/worker escoltant darrere d'aquestes rutes. No crear
crm.aimetos.com fins a validar autenticacio, persistencia i recuperacio externa.

Intervencio manual immediata: completar els quatre secrets/URLs a Entorno dels
dos serveis pel panell HTTPS i guardar. ADMIN_PASSWORD nou independent de
Control Center, minim 20 caracters; AUTH_SECRET aleatori minim 48 caracters
(recomanat 64). Copiar la URL interna de crm-postgres a les dues URLs. Mai
enganxar aquests valors al xat. No activar Create env file ni clicar Implementar.
Retirar tambe els dos dominis automatics abans de retornar el control.

Pendents posteriors: acces segur al host per cron/rclone, OAuth Drive,
desxifrat/restore extern, DNS A crm -> 72.62.31.48, build Docker, migracions,
bootstrap, health checks, transferencia idempotent i E2E productiu aillat.
L'exportacio aprovada esta preparada, pero el consumidor productiu i la prova
de repeticio encara s'han de completar; no executar l'importador GHL generic.
Revocacio de la clau antiga n8n pendent d'acreditacio; nomes l'usuari la revoca
des de Settings > n8n API, identificant la clau exposada, sense modificar demo.

Validacio del commit publicat, despres dels pedaços compatibles: lint 0 errors
(1 avis Apollo preexistent), typecheck i build correctes, 59/59 unit,
33/33 integracio i 5/5 E2E. Els primers intents amb base local inactiva,
DLL Prisma bloquejada i hostname E2E diferent es van corregir sense modificar
logica CRM i es van repetir amb exit. No repetir la bateria si no canvia codi.

Backup escollit: scripts + pg_dump + cron + rclone crypt, no Duplicati.
Decisio i accions manuals a PRODUCTION_CRM_RUNBOOK.md. 0 EUR recurrents nous.
Cap servei existent, demo, Control Center o dashboard modificat/reiniciat.
Els apartats historics de sota queden subordinats a aquest punt de represa.

### Prioritat vigent: producció del pipeline manual

La migració/auditoria GHL queda ajornada. L'objectiu actual és posar en marxa
el CRM existent a `https://crm.aimetos.com`, aïllat del Control Center i de tots
els altres serveis del VPS Hostinger. **Encara no està desplegat en producció.**

Configuració acordada:

- Projecte intern existent `aimetos-control-center`, sense reanomenar-lo.
  `aimetos-internal` és només el nom funcional. No cal ampliar la llicència.
- Serveis `crm-app` i `crm-worker` creats com a configuració buida sense
  desplegar. `crm-postgres` creat i arrencat: postgres:16-alpine, aimetos_crm,
  usuari crm_app, port exposat 0. Volum propi verificat a
  /etc/easypanel/projects/aimetos-control-center/crm-postgres/data, muntat a
  /var/lib/postgresql/data. Encara sense esquema CRM ni dades comercials.
- Admin `aimetos.agent@gmail.com`, variable `ADMIN_PASSWORD` independent de
  `CONTROL_CENTER_PASSWORD`, que no s'ha consultat ni reutilitzat.
- Backup diari extern a Google Drive amb rclone crypt, sense contractar serveis.
- Sense GHL, Stripe live, SMTP real ni migració de formularis/workflows.
- No s'ha modificat, reiniciat ni eliminat cap servei del VPS.

### Canvis comercials mínims completats

- Creació manual existent d'empreses, contactes i oportunitats conservada.
- Edició web afegida per als tres registres, amb validació, auditoria i
  autorització per organització. Enllaç `Edita` a cada fitxa.
- Fitxa d'oportunitat accessible des del títol de la targeta Kanban, amb notes
  de reunió, compromisos i tasques relacionades.
- Acció `Programa seguiment` amb oportunitat preseleccionada, data i responsable.
- Filtre `Obertes sense pròxima acció`: oportunitats obertes sense tasca activa
  futura amb responsable actiu; els seguiments vençuts tornen a sortir aquí.
- Kanban i filtres Avui/Properes/Vençudes/Completades conservats.
- Imports inicials/recurrents, periodicitat i data d'inici accessibles des de
  l'edició/creació d'oportunitat. Tres camps nous en migració additiva, sense
  sistema de subscripcions ni càrrecs. Catàleg existent conservat.
- Reprogramació de tasques amb data/hora i responsable; es reprograma el mateix
  job, no se'n creen duplicats. Historial d'etapes i motiu de pèrdua visibles.
- Dashboard amb pròxims seguiments i oportunitats sense pròxima acció.
- Descomptes accessibles als formularis de documents; PDF privat d'esborrany
  sense enviament ni emissió. SMTP no configurat indicat explícitament.
- Emissió fiscal bloquejada al servidor en producció tret d'activació explícita
  posterior a validació normativa. No es declara compatibilitat VeriFactu.

### Preparació productiva

- `scripts/bootstrap-production.ts`: bootstrap explícit, idempotent i sense
  demos; només admin, organització, dades fiscals i pipeline de 12 etapes.
  No reescriu organitzacions existents ni crea formularis.
- `scripts/production-preflight.mjs`: bloqueja runtime productiu sense flag
  explícit, HTTPS/domini correcte, secrets forts, base privada i demos desactivades.
- Worker amb heartbeat renovat després de consultar PostgreSQL i health check
  basat en antiguitat, no només en l'existència d'un fitxer.
- Backups, temporals i fitxers de secrets exclosos també del context Docker.
- `docker/backup-postgres.sh`: pg_dump, timestamp, lock, còpia Drive xifrada,
  verificació SHA256 rellegint la còpia externa; retenció configurable de
  7 còpies diàries, 4 setmanals i 3 mensuals; 14 dies locals per defecte.
- Valors exactes no secrets: `docker/production.env.example`.
- Instruccions operatives completes: `docs/PRODUCTION_CRM_RUNBOOK.md`.

### Validació d'aquesta fase

- 59 tests unitaris superats; typecheck i build de producció correctes.
- Bootstrap verificat en una instància de tests separada: 12 etapes, cap
  contacte/empresa/oportunitat/tasca/document/formulari demo, segona execució
  sense sobreescriptura.
- E2E manual: crear i editar empresa/contacte/oportunitat, nota de reunió,
  seguiment amb data i responsable, filtre sense pròxima acció i canvi d'etapa.
- Persistència local confirmada al navegador després de reiniciar l'aplicació
  i el servidor PostgreSQL de desenvolupament, sense seed ni reset.
- E2E existent de formulari → pressupost → acceptació → factura: 2/2.
- Recuperació comprovada també després d'un nou build de producció i arrencada
  en un altre port, amb la mateixa base. Peticions anònimes a contactes,
  pipeline, tasques i CSV redirigeixen al login. En total: 5 comprovacions E2E
  superades entre flux manual, recuperació, accés anònim i els dos fluxos antics.
- Previsualització local en execució: `http://localhost:3000`, només loopback;
  no confondre-la amb el domini productiu ni barrejar localhost i 127.0.0.1
  en la sessió (la cookie d'autenticació és específica del hostname).
- Lint sense errors (un avís preexistent al workflow Apollo).
- Sintaxi de docker/entrypoint.sh i docker/backup-postgres.sh validada amb Bash.
- Auditoria npm del 24/11, repetida abans de preparar la release: aplicats
  pedaços compatibles amb npm audit fix, sense force ni versions majors.
  Resten 4 avisos high de Prisma/config, deepmerge-ts i effect, i 3 moderate
  de Vitest/coverage/mocker; npm update no ofereix correcció compatible ara.
  El CLI és present a la imatge perquè executa migracions. No considerar la
  imatge lliure de vulnerabilitats: revisar/acceptar aquest risc abans de publicar;
  no s'ha fet una migració major de Prisma ni overrides incompatibles.
- 33/33 proves d'integració superades a la instància local de validació,
  no contra cap base del VPS. L'auxiliar `test:integration:isolated` exigeix
  `TEST_DATABASE_URL` local, separada i buida per al primer bootstrap.
- E2E actualitzats: 5/5 amb recurrència, reprogramació, accés anònim i flux
  complet de documents; captures desktop/mòbil de l'oportunitat revisades.
- Còpia local prèvia a migració:
  backups/postgres/aimetos-crm-20261124T172456Z.json.gz.
- Transferència controlada preparada a
  backups/migration/approved-commercial-transfer.json (ignorat per Git):
  Ramon Figueras/La Cabina, Jordi Olivé/autònom, Víctor Gutiérrez/Saló Guttié i
  20 productes. No importat. Demos, proves, documents, seqüències i secrets exclosos.

### Pendent abans de publicar

Accés al panell confirmat el 24/11 a `http://72.62.31.48:3000/`, amb sessió
iniciada. Recursos observats al panell: 4 cores, CPU 0,3%, RAM 1,9/15,6 GB
(12,3%) i disc 20,6/192,7 GB (10,7%). Hi ha marge orientatiu; no s'ha executat
cap benchmark ni comprovació del host per SSH.

El límit FREE de tres projectes es resol amb la nova topologia autoritzada:
CRM i Control Center independents dins d'`aimetos-control-center`. No s'ha
renomenat cap projecte. `demo` i `aimetos-dashboard` preservats.
S'han creat crm-app i crm-worker, encara sense font/build/execució, i
crm-postgres amb base buida persistent i privada. Cap servei existent modificat.

S'ha localitzat el domini HTTPS natiu del panell: https://abrfjv.easypanel.host/.
Carrega sense advertiment de certificat i la sessió HTTPS ja està autenticada.
Cap secret introduït per HTTP. SSH amb la clau
local disponible ha estat refusat; no s'han canviat claus ni credencials.
Segueixen pendents accés segur al host, Hostinger DNS, build Docker,
migracions/bootstrap, OAuth Drive, cron, restore extern i DNS/TLS.
No obrir el domini abans de validar-los. Estat actual: PARTIAL, no PASS.

La revocació de la clau d'n8n de l'historial de Git continua sense acreditar.
S'ha informat l'usuari abans de producció, sense provar-la ni tocar demo.
Topologia, límits i rutina de manteniment: docs/INFRASTRUCTURE.md.

L'arbre de treball es a `codex/crm-production`, release publicada `7e7bb66`.
Els canvis aliens d'aimetos-content-system continuen locals i sense incloure.
Nomes s'ha inclos la retirada ja preparada del fitxer .n8n-local.env de Git,
conservant-lo local i ignorat. main i el desplegament del Control Center intactes.

Les seccions següents conserven l'estat i les validacions de fases anteriors;
no impliquen validació del VPS ni del backup extern productiu.

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

- ESLint: correcte, sense errors; queda un avís preexistent al workflow d'Apollo.
- TypeScript estricte: correcte.
- Build Next.js de producció: correcte amb Webpack. Turbopack 16.4.5 presenta
  un pànic intern amb PostCSS en aquest entorn i per això l'script fixa
  `next build --webpack`.
- Unit tests: 57/57.
- Integration tests amb PostgreSQL: 25/25.
- Playwright E2E: 2/2 fluxos crítics.
- Restauració real: 37 taules i 278 files verificades en una base temporal.
- Migracions i seed: correctes.
- PDF de sis pàgines: renderitzat i revisat visualment.
- Worker i enviament SMTP real cap a Mailpit: validats.
- Esquema Prisma i `git diff --check`: correctes.

Docker no estava instal·lat a l'ordinador d'origen; el build de la imatge i el
desplegament EasyPanel encara s'han de provar en una màquina amb Docker.

## Robustesa preproducció tancada

El bloc local previ a qualsevol connexió amb GoHighLevel, Stripe live o SMTP
real queda completat:

- backup lògic de PostgreSQL consistent, comprimit i amb timestamp;
- restore protegit contra la base activa i verificat sobre una base temporal;
- exportació CSV d'empreses, contactes, oportunitats, pressupostos i factures;
- protecció de CSV contra injecció de fórmules i descàrregues sense memòria cau;
- logs JSON mínims per servidor, worker, SMTP, Stripe, webhooks i reintents;
- dependències de runtime vulnerables actualitzades sense canviar arquitectura;
- E2E encadenat: formulari → contacte/empresa → oportunitat/pipeline →
  pressupost → acceptació/PDF → factura → emissió local.

Les exportacions són accessibles des del botó `Exporta CSV` de cada llistat i
des de `/api/exports/{companies|contacts|opportunities|quotes|invoices}`. Totes
les consultes reben l'organització de la sessió; la prova d'integració crea dues
organitzacions i confirma que cap CSV conté dades de l'altra.

## Backup i restauració

Crear un backup de la base indicada per `DATABASE_URL`:

```powershell
npm run backup:postgres
```

Es desa a `backups/postgres/aimetos-crm-AAAAMMDDTHHMMSSZ.json.gz`. Aquest
directori està ignorat per Git i, en producció, s'haurà de replicar fora del
servidor.

Restaurar en una base separada que ja tingui les migracions aplicades:

```powershell
$env:RESTORE_DATABASE_URL = "postgresql://usuari:contrasenya@host:5432/aimetos_restore?schema=public"
npm run restore:postgres -- --backup=backups/postgres/aimetos-crm-AAAAMMDDTHHMMSSZ.json.gz
Remove-Item Env:RESTORE_DATABASE_URL
```

No s'ha d'usar `--allow-active-database` en operació normal. La comprovació
completa i no destructiva sobre la base activa és:

```powershell
npm run test:restore
```

La prova final del 8 de novembre ha creat `aimetos_restore_1794143584370`, ha
aplicat les migracions, ha restaurat 278 files de 37 taules, n'ha verificat els
recomptes i ha eliminat la base temporal.

## Revisió de seguretat

- Auth.js usa credencials amb hash bcrypt, `AUTH_SECRET` obligatori i sessió JWT
  amb caducitat de 8 hores.
- Cada petició autenticada torna a validar usuari, organització i membership
  actius a PostgreSQL; una revocació no espera que caduqui el JWT.
- Les pàgines i APIs internes passen per autenticació i les operacions exigeixen
  `requireTenant()` o `requireAdmin()` segons el cas.
- Les consultes i mutacions sensibles filtren per `organizationId`; les proves
  cobreixen revocació, moviments de pipeline entre tenants i exportacions entre
  dues organitzacions.
- `.env` i `backups/postgres/` estan ignorats i no estan versionats.
- S'ha detectat una clau d'n8n al fitxer local `aimetos-content-system/.n8n-local.env`.
  El fitxer queda exclòs de Git i es conserva al disc. Com que la clau consta
  en commits anteriors, cal revocar-la i substituir-la a les configuracions
  locals que la fan servir. Ignorar el fitxer no esborra l'historial.
- El logger redueix missatges a 4.000 caràcters i censura contrasenyes de URL,
  tokens Bearer, cookies, secrets i API keys.
- Cal substituir la contrasenya demo abans de compartir o desplegar l'entorn.

`npm audit` ja no assenyala les versions de runtime de Next, Auth.js,
Nodemailer o Zod. Encara informa d'advisories transitives del CLI de
desenvolupament Prisma 6; l'única correcció oferta és migrar a Prisma 7, canvi
major que s'ha deixat fora d'aquest tancament per no alterar arquitectura.

## Logs operatius

Sense afegir cap plataforma de monitoring, els processos emeten JSON a stdout i
stderr amb esdeveniments estables:

- servidor: `server.request_error`;
- worker i jobs: inici, claim, finalització, error, reintent, recuperació de
  leases i error fatal;
- SMTP: `smtp.send_started`, `smtp.sent`, `smtp.failed`;
- Stripe: creació/error de checkout i recepció/resultat de webhook;
- webhooks sortints: entrega, reintent programat i fallada final.

No es registren cossos de correu, endpoints secrets, credencials ni payloads
complets.

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

## Fase ajornada: auditoria de GHL en només lectura

Crear una [integració privada de HighLevel](https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/)
limitada al subcompte d'AImetos, no a l'agència. Caldran el `Location ID` i el
token en un fitxer local ignorat (per exemple, `.env.local` amb
`GHL_LOCATION_ID` i `GHL_READONLY_TOKEN`). No posar el token al xat, al
repositori, a l'historial de comandes ni als logs.

- Començar amb `opportunities.readonly` i `forms.readonly` per inventariar
  pipelines, etapes i formularis. Limitar les crides a una llista explícita
  de consultes `GET` documentades; no llegir enviaments de formulari.
- Només si cal ampliar l'inventari, afegir el
  [permís de lectura corresponent](https://marketplace.gohighlevel.com/docs/Authorization/Scopes/):
  `contacts.readonly`, `businesses.readonly`, `workflows.readonly`,
  `calendars.readonly`, `invoices/estimate.readonly` o `invoices.readonly`.
  No concedir cap permís d'escriptura. No cridar rutes de generació de números
  de document, encara que siguin `GET`.
- Lliurar un inventari amb recomptes, mapatge al model local i buits de cobertura.
  No desar respostes amb dades personals ni interpretar un error de permisos
  com un inventari buit. Si falta informació a l'API, anotar-la per revisar-la
  manualment; no ampliar permisos d'ofici.
- Sense importació ni escriptures a PostgreSQL o GHL, sense activar webhooks o
  workflows i sense modificar formularis, dominis ni integracions existents.

En aquest tancament no s'ha connectat GHL, no s'han importat workflows, no
s'han canviat els formularis existents, no s'ha configurat Stripe real i no
s'ha desplegat res a producció.

## Estat de Git i bloquejos pendents

El CRM MVP continua visible al remot
`https://github.com/aimetosagent-oss/AImetos.git`. Els canvis de migració des de
GoHighLevel descrits a l'apartat anterior són locals i encara no s'han publicat.

En aquesta màquina s'utilitza el runtime Node agrupat amb Codex i `prisma dev`
com a PostgreSQL local. Docker continua sense estar instal·lat. El desplegament
EasyPanel i `docker compose build` queden pendents d'una màquina amb Docker o
de l'accés al panell de desplegament.

