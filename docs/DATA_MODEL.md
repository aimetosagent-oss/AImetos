# Model de dades

La font de veritat és [`prisma/schema.prisma`](../prisma/schema.prisma). PostgreSQL desa dates en UTC; la zona horària d'organització només s'aplica en presentació i planificació.

## Convencions

- IDs: `String` amb `cuid()` excepte tokens externs.
- Tenant: `organizationId` a totes les dades de negoci i operació.
- Imports: enters en cèntims (`*Cents`), mai `float`.
- Percentatges i impostos: punts bàsics (`*Bps`); `2100` representa 21 %.
- Moneda: codi de tres lletres, habitualment `EUR`.
- Text llarg: camps `@db.Text`; metadades variables: `Json`.
- Soft delete: `deletedAt`; arxiu funcional: `archivedAt`; documents emesos canvien d'estat, no s'eliminen.
- Històric: `Activity` per timeline de negoci i `AuditLog` per accions sensibles.

## Identitat i organitzacions

| Model | Funció i restriccions principals |
|---|---|
| `Organization` | Arrel del tenant. El seu esborrat fa cascade; només és acceptable en una purga administrativa explícita. |
| `OrganizationSettings` | Configuració 1:1: dades fiscals, moneda, IVA, numeració, seguiments i flags d'integració. |
| `User` | Identitat global; `email` és únic globalment. No conté `organizationId`. |
| `Membership` | Uneix usuari i organització amb rol `ADMIN` o `MEMBER`; únic per `(organizationId, userId)`. |
| `Account`, `VerificationToken`, `Session` | Estructures compatibles amb Auth.js. El flux actual de credencials usa JWT; `User`, `Membership` i `AuditLog` són les peces persistents actives. |

Un usuari pot tenir diverses memberships. La sessió activa selecciona una organització i totes les consultes posteriors han de reutilitzar aquest `organizationId`.

## CRM i pipeline

| Model | Funció i relacions clau |
|---|---|
| `Company` | Empresa, propietari opcional i identificadors normalitzats. Email, telèfon, NIF i Stripe Customer són únics dins del tenant. |
| `Contact` | Persona, empresa opcional i propietari. Email i telèfon normalitzats són únics dins del tenant. |
| `Lead` | Estat previ/comercial; pot enllaçar empresa, contacte i una única oportunitat. |
| `Pipeline` | Pipeline tenant-scoped; `slug` únic per organització. |
| `PipelineStage` | Etapa ordenada dins del pipeline; `slug` i `position` són únics per pipeline. |
| `Opportunity` | Uneix pipeline i etapa amb empresa/contacte/owner opcionals; valor en cèntims i estat `OPEN`, `WON` o `LOST`. |
| `OpportunityStageHistory` | Registre immutable de cada canvi `fromStage` -> `toStage`, actor, motiu i data. |

Les relacions Prisma apunten per ID. El servei ha de comprovar que pipeline, etapa, empresa, contacte i owner comparteixen `organizationId` abans d'escriure; la foreign key no ho valida automàticament.

## Formularis, activitat i treball

| Model | Funció i restriccions principals |
|---|---|
| `Form` | Configuració del formulari, pipeline i etapa inicial. `slug` és únic per organització. |
| `FormField` | Camp ordenat; `name` i `position` són únics dins del formulari. |
| `FormSubmission` | Payload original i processat, UTM, consentiment, hashes antiabús i entitats creades. `requestId` és únic per tenant. |
| `Activity` | Timeline tipada i append-oriented; pot apuntar a les entitats comercials principals. |
| `Note` | Nota interna amb autor i relacions opcionals; admet soft delete. |
| `Task` | Tasca assignable amb estat, prioritat, venciment i relacions comercials opcionals. |
| `RateLimitCounter` | Comptador per tenant, namespace, hash i finestra; no desa la IP en clar. |

`Form.slug` no és globalment únic. Una ruta pública ha de resoldre el tenant per domini/prefix o aplicar una política addicional de slug global. Fins que existeixi aquesta resolució, no s'han de crear slugs duplicats entre organitzacions.

## Productes i documents

| Model | Funció i restriccions principals |
|---|---|
| `Product` | Catàleg tenant-scoped; `sku` i IDs Stripe són únics per organització. |
| `DocumentSequence` | Comptador per `(organizationId, type, year)` amb prefix i padding. S'actualitza dins d'una transacció. |
| `Quote` / `QuoteItem` | Pressupost i línies ordenades. Número únic per tenant i `publicToken` únic globalment. |
| `Invoice` / `InvoiceItem` | Factura i línies. Número únic per tenant; IDs Stripe i `publicToken` són únics. `quoteId` únic limita a una factura per pressupost. |
| `Payment` | Pagament manual o Stripe. Idempotència i IDs externs únics dins del tenant. |

Els totals de quote/invoice i línies es calculen al servidor. Una factura emesa no té `deletedAt`: es conserva i passa a `CANCELLED` quan correspongui.

## Automatització i integracions

| Model | Funció i restriccions principals |
|---|---|
| `ScheduledJob` | Cua PostgreSQL amb `runAt`, intents, lease, payload i relacions opcionals. `deduplicationKey` és únic per tenant quan existeix. |
| `OutboxEvent` | Esdeveniment creat a la transacció de negoci; `idempotencyKey` únic per tenant. `webhookDispatchEnabled` permet conservar-lo internament sense fan-out extern. |
| `WebhookEndpoint` | URL, filtre `eventTypes`, secret xifrat i estat/arxiu. Nom únic per tenant. |
| `WebhookDelivery` | Entrega endpoint + event; la parella és única i conserva intents, resposta i lease. |
| `EmailMessage` | Correu pendent/enviat amb cos, adjunts, reintents i idempotència tenant-scoped. |
| `StripeEvent` | Inbox de Stripe; `stripeEventId` únic per tenant evita processar el mateix event dues vegades. |
| `StripeSubscription` | Projecció mínima d'una subscripció externa, única per tenant i ID Stripe. |
| `AuditLog` | Actor, acció, entitat, before/after i metadades. És append-only a nivell d'aplicació. |

## Estats persistents

| Àrea | Valors exactes |
|---|---|
| Lead | `NEW`, `CONTACTED`, `QUALIFIED`, `DISQUALIFIED`, `CONVERTED` |
| Oportunitat / tipus d'etapa | `OPEN`, `WON`, `LOST` |
| Tasca | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| Pressupost | `DRAFT`, `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED` |
| Factura | `DRAFT`, `ISSUED`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED` |
| Pagament | `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED` |
| Job | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| Outbox | `PENDING`, `PROCESSING`, `DELIVERED`, `FAILED` |
| Entrega webhook | `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED` |
| Correu | `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `CANCELLED` |
| Event Stripe | `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`, `IGNORED` |

Altres discriminants de l'esquema:

- Camps de formulari: `TEXT`, `EMAIL`, `PHONE`, `TEXTAREA`, `NUMBER`, `SELECT`, `CHECKBOX`, `HIDDEN`.
- Job: `QUOTE_REMINDER`, `QUOTE_EXPIRE`, `INVOICE_REMINDER`, `INVOICE_OVERDUE`, `WEBHOOK_DELIVERY`, `EMAIL_SEND`, `TASK_DUE`, `STRIPE_EVENT`, `GENERIC`.
- Billing: `ONE_TIME`, `RECURRING`; descompte: `PERCENTAGE`, `FIXED`; mètode de pagament: `MANUAL`, `STRIPE`.
- `ActivityType` és un catàleg intern en majúscules; els noms de `OutboxEvent.eventType` són contractes externs en minúscules i no són intercanviables.

## Idempotència i concurrència

| Operació | Barrera persistent |
|---|---|
| Submission repetida | `FormSubmission (organizationId, requestId)` |
| Event de domini repetit | `OutboxEvent (organizationId, idempotencyKey)` |
| Job repetit | `ScheduledJob (organizationId, deduplicationKey)` |
| Entrega webhook repetida | `WebhookDelivery (endpointId, eventId)` |
| Correu repetit | `EmailMessage (organizationId, idempotencyKey)` |
| Pagament repetit | `Payment` per idempotency key i IDs externs |
| Webhook Stripe repetit | `StripeEvent (organizationId, stripeEventId)` |
| Número documental concurrent | `DocumentSequence` bloquejada i número únic per tenant |

Una clau única és l'última defensa, no un substitut del flux idempotent: el servei ha de tractar `unique conflict` com a repetició esperada quan la petició pot arribar més d'una vegada.

## Índexs i consultes

Els índexs principals comencen per `organizationId` i continuen amb estat/data o foreign key. Mantén aquest patró en noves consultes de llistat. Evita carregar timelines o línies sense paginació, i no facis cerques globals sense tenant.

## Migracions

- Desenvolupament d'esquema: `npm run db:migrate:dev`.
- Aplicació d'esquema versionat: `npm run db:migrate` (`prisma migrate deploy`).
- Seed: `npm run db:seed`, separat de les migracions.

No s'utilitza `db push` en producció. Revisa el SQL, fes backup abans d'un canvi destructiu i desplega migracions una sola vegada abans d'App i Worker.
