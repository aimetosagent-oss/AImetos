# Desenvolupament local

Aquest document descriu l'entorn local del CRM. La ruta principal és Docker Compose, perquè arrenca exactament els quatre processos necessaris: aplicació, worker, PostgreSQL i Mailpit. Les migracions s'executen en un contenidor d'un sol ús abans d'arrencar l'aplicació i el worker.

## Requisits

- Docker Desktop o Docker Engine amb Docker Compose v2.
- Com a mínim 4 GB de RAM disponibles per a Docker.
- Ports lliures: `3000` (CRM), `5432` (PostgreSQL), `8025` (Mailpit web) i `1025` (Mailpit SMTP).
- Node.js 24 i npm només si es vol executar sense Docker.

Comprova les eines:

```bash
docker --version
docker compose version
node --version
npm --version
```

En PowerShell, si l'execució de scripts bloqueja `npm.ps1`, utilitza `npm.cmd` i `npx.cmd`.

## Primera arrencada amb Docker

1. Crea l'arxiu local de configuració:

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS/Linux:

   ```bash
   cp .env.example .env
   ```

2. Revisa com a mínim `AUTH_SECRET`, `ADMIN_EMAIL` i `ADMIN_PASSWORD`. Pots generar un secret local així:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

3. Construeix i arrenca tots els serveis:

   ```bash
   docker compose up --build
   ```

L'ordre d'arrencada és deliberat:

1. PostgreSQL i Mailpit passen els seus health checks.
2. El servei efímer `migrate` executa `npm run db:migrate` una sola vegada. Aquest script està definit com `prisma migrate deploy` i no crea migracions noves.
3. `app` i `worker` només arrenquen si la migració acaba correctament.

El seed no s'executa automàticament, per evitar que una arrencada normal modifiqui dades. A la primera instal·lació, executa'l en un altre terminal:

```bash
docker compose run --rm app seed
```

Adreces locals:

- CRM: <http://localhost:3000>
- Salut: <http://localhost:3000/api/health>
- Mailpit: <http://localhost:8025>
- PostgreSQL: `localhost:5432`

Amb els valors inicials de `.env.example`, l'accés és `admin@aimetos.local` / `AdminAimetos2026!`. Canvia'l a `.env`; aquestes credencials són exclusivament locals.

## Operacions habituals

```bash
# Estat i health checks
docker compose ps

# Logs de tots els serveis
docker compose logs -f

# Només l'aplicació i el worker
docker compose logs -f app worker

# Reconstruir després de canviar dependències o codi de servidor
docker compose up --build -d

# Aturar sense eliminar les dades
docker compose down
```

`docker compose down -v` també elimina PostgreSQL i els missatges de Mailpit. És destructiu i només s'ha d'utilitzar per reiniciar completament l'entorn de desenvolupament.

## Base de dades, migracions i seed

Hi ha dues operacions diferents:

- `npm run db:migrate:dev`: crea/aplica una migració durant el desenvolupament de l'esquema.
- `npm run db:migrate`: aplica només les migracions versionades amb `prisma migrate deploy`; és la comanda usada pels contenidors i producció.

Comandes útils amb Docker:

```bash
# Aplicar de nou les migracions pendents de manera controlada
docker compose run --rm migrate

# Crear o actualitzar dades inicials/demostració
docker compose run --rm app seed

# Obrir psql
docker compose exec postgres psql -U aimetos -d aimetos_crm
```

Per crear una migració nova mentre es desenvolupa l'esquema:

```bash
docker compose run --rm --entrypoint npx app prisma migrate dev --name nom_descriptiu
```

Revisa sempre el SQL generat abans d'incloure'l en un desplegament.

### Còpia local de PostgreSQL

```bash
docker compose exec -T postgres pg_dump -U aimetos -d aimetos_crm --clean --if-exists > aimetos-crm.sql
```

Per restaurar-la en una base buida, utilitza `psql` des d'un terminal que no alteri la codificació del fitxer:

```bash
docker compose exec -T postgres psql -U aimetos -d aimetos_crm < aimetos-crm.sql
```

## Execució sense Docker

Cal tenir PostgreSQL local i crear una base de dades. Mailpit és opcional; sense SMTP configurat, el CRM continua funcionant però no entrega correus.

1. Instal·la dependències:

   ```bash
   npm ci
   ```

2. Copia `.env.example` a `.env` i substitueix les connexions Docker per URLs accessibles des de l'host. Amb `npm run db:dev`:

   ```dotenv
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable&pgbouncer=true&connection_limit=1
   DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable&pgbouncer=true&connection_limit=1
   SHADOW_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51215/template1?sslmode=disable&pgbouncer=true&connection_limit=1
   AUTH_URL=http://localhost:3000
   APP_URL=http://localhost:3000
   ```

3. Prepara la base de dades:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. Arrenca dos terminals:

   ```bash
   npm run dev
   ```

   ```bash
   npm run worker
   ```

## Qualitat i tests

```bash
npm run lint
npm run typecheck
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Els tests d'integració i E2E necessiten PostgreSQL; arrenca almenys `postgres` abans d'executar-los:

```bash
docker compose up -d postgres mailpit
```

## Correu amb Mailpit

En Compose, l'aplicació i el worker utilitzen `mailpit:1025` sense autenticació. La bústia web és <http://localhost:8025>. Mailpit captura el correu: no envia missatges a destinataris reals.

Si executes Node directament a l'host, utilitza:

```dotenv
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

## IP de client i proxies de confianca

El formulari public ignora `X-Forwarded-For` per defecte i aplica el rate limit
amb una empremta estable i reduida de capcaleres del navegador. No s'utilitza
cap identificador aleatori com a alternativa, de manera que peticions repetides
continuen compartint el mateix bucket.

Si l'aplicacio nomes es accessible a traves d'una cadena controlada de reverse
proxies, configureu-ne el nombre exacte. Amb un unic proxy d'EasyPanel:

```dotenv
PUBLIC_FORM_TRUSTED_PROXY_HOPS=1
AUTH_TRUSTED_PROXY_HOPS=1
```

La IP es selecciona des de la dreta de la cadena, ignorant prefixos que el
client podria haver falsificat. El port de l'aplicacio no s'ha d'exposar
directament: si un client pot saltar-se el proxy, tambe podria falsificar tota
la capcalera. Manteniu el valor `0` si aquesta garantia de xarxa no existeix.

## Stripe en mode test

Stripe és opcional. Sense claus, els botons de pagament queden desactivats i la resta del CRM funciona.

Per provar webhooks locals:

1. Configura claus `sk_test_...` i `pk_test_...`; no utilitzis claus live.
2. Autentica Stripe CLI i reenvia els esdeveniments:

   ```bash
   stripe login
   stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
   ```

3. Copia el secret `whsec_...` que mostra la CLI a `STRIPE_WEBHOOK_SECRET` i reinicia `app`.
4. Genera esdeveniments de test des de Stripe CLI o completa un Checkout de prova.

Com que `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` s'incrusta al bundle del navegador, reconstrueix la imatge (`docker compose up --build`) després de canviar-la.

## Resolució de problemes

### Un port ja està ocupat

Canvia només el port publicat; els ports interns no canvien:

```dotenv
APP_PORT=3001
POSTGRES_PORT=5433
MAILPIT_UI_PORT=8026
MAILPIT_SMTP_PORT=1026
```

### `migrate` falla

```bash
docker compose logs postgres migrate
docker compose run --rm migrate
```

No forcis l'arrencada d'`app` saltant la migració. Corregeix la migració o la configuració de `DATABASE_URL`.

### L'aplicació no es considera saludable

```bash
docker compose logs app
docker compose exec app wget -qO- http://127.0.0.1:3000/api/health
```

El health endpoint ha de retornar èxit només quan el procés web i la dependència crítica de base de dades estan disponibles.

### El worker reinicia contínuament

```bash
docker compose logs worker
```

El contenidor executa el mateix script `npm run worker` que l'entorn sense Docker. Una imatge antiga o un error carregant `src/worker/main.ts` farà que el procés acabi i Compose el reiniciï.
