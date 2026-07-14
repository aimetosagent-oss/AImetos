# Webhooks i outbox

El CRM utilitza dos fluxos diferents:

- **Sortint**: esdeveniments AImetos cap a n8n o altres endpoints, lliurats pel Worker.
- **Entrant**: webhooks Stripe a `/api/webhooks/stripe`, verificats amb el signing secret de Stripe.

Un webhook sortint és at-least-once. La idempotència del receptor és obligatòria.

## Flux sortint

1. El servei de domini crea `OutboxEvent` dins de la mateixa transacció que el canvi comercial.
2. El Worker reclama l'esdeveniment/job amb lease PostgreSQL.
3. Per cada `WebhookEndpoint` actiu, no arxivat, del mateix `organizationId` i subscrit a `eventType`, crea o reutilitza una `WebhookDelivery`.
4. La restricció única `(endpointId, eventId)` evita duplicar la fila d'entrega.
5. El Worker envia HTTP fora de la transacció, registra headers, status/resposta i actualitza l'estat.
6. Errors temporals es reprogramen; errors permanents o el límit d'intents acaben en `FAILED`.

`OutboxEvent.webhookDispatchEnabled` separa la persistencia interna del fan-out
extern. Els formularis sempre creen activitats i esdeveniments outbox, pero els
tres esdeveniments originats per una submission hereten el valor
`Form.webhookEnabled`. Quan es `false`, el dispatcher processa l'esdeveniment
sense crear cap `WebhookDelivery`; per tant, tampoc pot arribar a endpoints
subscrits a `contact.*` o `opportunity.created` per una via indirecta.

`OutboxEvent.id` és l'identificador públic estable. No es genera un ID nou en cada intent.

## Cos de la petició

Contracte JSON v1:

```json
{
  "id": "cm...",
  "type": "form.submitted",
  "occurredAt": "2026-07-14T08:30:00.000Z",
  "organizationId": "cm...",
  "aggregate": {
    "type": "FormSubmission",
    "id": "cm..."
  },
  "data": {
    "submissionId": "cm...",
    "contactId": "cm...",
    "opportunityId": "cm..."
  }
}
```

El Worker serialitza el cos una vegada per entrega i signa exactament els bytes UTF-8 enviats. L'ID, tipus, `occurredAt`, aggregate i dades provenen de l'`OutboxEvent` persistent i es mantenen en els reintents.

No s'inclouen secrets, hashes interns, contrasenyes, claus Stripe ni camps no necessaris. Afegir camps és compatible; eliminar-los o canviar-ne el significat requereix una nova versió de contracte.

## Headers

| Header | Valor |
|---|---|
| `Content-Type` | `application/json; charset=utf-8` |
| `X-Aimetos-Event` | `OutboxEvent.eventType` |
| `X-Aimetos-Event-Id` | `OutboxEvent.id`, estable en tots els intents |
| `X-Aimetos-Timestamp` | Unix epoch en segons, com a string decimal |
| `X-Aimetos-Signature` | HMAC-SHA256 en hexadecimal minúscul |

## Signatura HMAC

Cada endpoint té un secret propi. A la base només es desa `secretEncrypted`, xifrat amb AES-256-GCM i la clau mestra `INTEGRATION_ENCRYPTION_KEY` (32 bytes en base64). `secretHint` pot ajudar a identificar-lo, però no autentica.

La cadena signada és exactament:

```text
<timestamp>.<rawBody>
```

La signatura és:

```text
hex_lowercase(HMAC_SHA256(endpoint_secret, timestamp + "." + rawBody))
```

Exemple de verificació Node.js:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyAimetosWebhook(
  secret: string,
  timestamp: string,
  rawBody: string,
  receivedHex: string,
) {
  if (!/^[0-9a-f]{64}$/.test(receivedHex)) return false;

  const now = Math.floor(Date.now() / 1000);
  const sentAt = Number(timestamp);
  if (!Number.isSafeInteger(sentAt) || Math.abs(now - sentAt) > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest();
  const received = Buffer.from(receivedHex, "hex");

  return expected.length === received.length && timingSafeEqual(expected, received);
}
```

El receptor ha de llegir el cos cru abans de parsejar JSON. Tornar a serialitzar un objecte pot canviar els bytes i invalidar la signatura. La comparació és constant-time i es rebutgen timestamps fora d'una finestra curta, recomanada de 5 minuts.

## Idempotència del receptor

Una entrega pot haver produït l'efecte remot encara que el Worker no rebi la resposta. Per això, un retry és normal.

El receptor ha de:

1. verificar timestamp i HMAC;
2. començar una transacció local;
3. inserir `X-Aimetos-Event-Id` en una taula amb índex únic;
4. si ja existeix, no repetir l'efecte i respondre `2xx`;
5. aplicar l'efecte i confirmar la transacció;
6. respondre `2xx` només després de confirmar.

En n8n, la mateixa regla exigeix persistir l'event ID en una base o data store amb unicitat. La memòria d'una execució no és suficient.

## Estats, reintents i retry manual

`WebhookDelivery.status` utilitza els valors exactes:

```text
PENDING -> PROCESSING -> SUCCEEDED
                      -> PENDING  (error reintentable)
                      -> FAILED   (permanent o maxAttempts)
PENDING/PROCESSING -> CANCELLED
```

- Reintentables: timeout, error de xarxa, `408`, `425`, `429` i `5xx`.
- Permanents: URL invàlida i altres `4xx`, excepte si una política explícita diu el contrari.
- Backoff base: 30 s exponencial, limitat a 1 hora.
- Límit per defecte de `WebhookDelivery.maxAttempts`: 8.
- `responseBody` es trunca/sanititza abans de persistir; mai es registren secrets.

Un retry manual reutilitza la mateixa `WebhookDelivery` i el mateix `eventId`, neteja el lease, fixa `nextAttemptAt = now()` i torna a `PENDING`. No crea un nou `OutboxEvent`.

## Catàleg d'esdeveniments

`OutboxEvent.eventType` és un string per permetre evolució. Els noms canònics són:

```text
form.submitted
contact.created
contact.updated
opportunity.created
opportunity.stage_changed
quote.created
quote.sent
quote.viewed
quote.accepted
quote.rejected
quote.expired
quote.followup_due
invoice.created
invoice.sent
invoice.paid
invoice.overdue
invoice.reminder_due
task.created
task.due
```

El flux de formulari públic emet actualment `form.submitted`, `contact.created` o `contact.updated`, i `opportunity.created`. La resta del catàleg és el contracte per als mòduls corresponents; no s'ha d'anunciar un event com disponible fins que el productor transaccional i els tests existeixin.

Claus d'idempotència recomanades:

```text
form.submitted:<submissionId>
opportunity.created:<opportunityId>
opportunity.stage_changed:<historyId>
quote.sent:<quoteId>:<sentAt>
invoice.paid:<invoiceId>:<paymentId>
task.due:<taskId>:<dueAt>
```

La base imposa unicitat sobre `(organizationId, idempotencyKey)`. La clau ha de representar l'acció semàntica, no un intent de transport.

## Webhooks Stripe entrants

Stripe no utilitza els headers Aimetos. El handler:

1. llegeix el raw body;
2. verifica `Stripe-Signature` amb `STRIPE_WEBHOOK_SECRET` mitjançant l'SDK oficial;
3. determina l'organització a partir dels identificadors/metadades Stripe confiables, mai d'un camp lliure del client;
4. insereix `StripeEvent` amb `(organizationId, stripeEventId)` únic;
5. processa l'esdeveniment de manera idempotent dins la petició i només respon quan la transacció ha acabat;
6. actualitza `StripeEvent.status` a `PROCESSED`, `FAILED` o `IGNORED`.

Si l'insert troba un duplicat, es retorna `2xx` sense repetir pagaments ni canvis de pipeline. Un `Payment` té una segona barrera per `idempotencyKey`, `externalPaymentId` i `stripePaymentIntentId` dins del tenant.

## Operació i seguretat

- Només URLs `https://` en producció; bloqueja loopback, link-local i xarxes internes per evitar SSRF.
- Resolve DNS i aplica la política SSRF en cada intent, incloses redireccions.
- Defineix timeout curt i límit de mida de resposta.
- No segueixis redireccions a hosts no validats.
- Rotar un secret modifica l'endpoint; els intents posteriors usen el secret vigent.
- Registra event ID, endpoint ID, intent, latència i status; no el payload complet si conté PII.
- Alertes mínimes: entregues `FAILED`, backlog antic, leases obsolets i taxa elevada de `429`/`5xx`.

Per provar un endpoint, utilitza dades de demostració i mode Stripe test. No enviïs contactes reals a eines de captura públiques.
