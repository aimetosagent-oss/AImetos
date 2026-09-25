# AImetos Content Decision Engine

## Objectiu

El Content Decision Engine separa dades, regles deterministes, interpretació amb OpenAI i decisió humana. El dashboard és la interfície del motor, no la font de veritat.

La pregunta principal és: quina publicació aporta més valor empresarial i més aprenentatge útil ara, no només quina pot obtenir més impressions.

## Arquitectura

1. **Data adapter**: el runtime actual llegeix `real-content.json`, `platform-snapshots.json`, `editorial-memory.json`, `market-signals.json` i les captures manuals. L'esquema Prisma existeix, però aquesta experiència encara no l'utilitza.
2. **Canonical state**: `buildEditorialState()` normalitza posts, snapshots, maduració, timing, patrons, experiments, audiència, propagació, negoci, candidats i advertències.
3. **Deterministic engine**: `buildContentDecision()` aplica guard de publicats, realitat, authority fit, diversitat, repetició narrativa, format, timing, experiment i cadència.
4. **LLM reasoning**: el Director rep l'estat i la decisió com a context immutable. Pot explicar, debatre i redactar; no pot canviar fets deterministes.
5. **User decision**: aprovar, rebutjar o demanar una alternativa registra una acció explícita. El xat no modifica estat important per inferència.

Fitxers principals:

- `packages/core/src/editorial-state.ts`
- `packages/core/src/content-decision-engine.ts`
- `packages/core/src/editorial-control-store.ts`
- `packages/core/src/content-director.ts`
- `apps/api/src/server.ts`
- `apps/dashboard/public/app.js`

## Flux de dades

```text
fixtures actuals / futur adapter Prisma
  -> freshness precedence i normalització
  -> buildEditorialState()
  -> scoring i restriccions deterministes
  -> buildContentDecision()
  -> dashboard + context del Director
  -> aprovació / rebuig / debat / alternativa
  -> editorial-control.json
```

`buildClientMonthlyReport()` continua sent el contracte compatible amb el dashboard, però ara incorpora `editorialState` i `contentDecision`. La recomanació visible es deriva del motor, no de les tres idees antigues del mock flow.

## Regles deterministes

### Freshness

- El snapshot vàlid amb `capturedAt` més recent preval encara que l'array estigui desordenat.
- L'historial es conserva complet.
- Un snapshot amb `valid: false` no pot guanyar precedència.
- Una finestra rolling es tracta com a context agregat, no com a prova causal.

### Guard de publicats

- Compara títol, hook i tema normalitzats.
- Utilitza coincidència exacta i Jaccard de tokens amb reforç moderat de família.
- A partir del llindar establert, la candidata queda `already_published` i no pot ser recomanada com a nova.
- Reutilitzar o transformar una peça requerirà una intenció explícita futura.

### Maduració

- `<24h`: `EARLY_SIGNAL`
- `24–72h`: `PROVISIONAL`
- `72h–7d`: `MATURING`
- `>=7d`: `COMPARABLE`

El motor conserva les finestres disponibles i genera una advertència quan conviuen posts provisionals i comparables. PM usa 267 impressions a 7 dies, no el primer snapshot de 110. Aprovacions usa 76 a aproximadament 43 hores i no es considera comparable.

### Timing

Slots estudiats: 07–08, 08–10, 12–14, 15–17 i 17–20.

- `08–10` és `baseline_most_tested`, no `best_time`.
- Calen almenys 3 posts comparables en dues franges per començar a desenvolupar una comparació.
- `moderate_evidence` exigeix almenys 5 posts comparables en dues franges.
- `strong_pattern` exigeix almenys 5 posts en tres franges i 18 posts comparables totals.
- La UI només mostra “Millor hora” amb evidència moderada o forta. Fins llavors mostra “Hora recomanada actual”.

### Confiança separada

La decisió publica quatre dimensions independents:

- `content`
- `timing`
- `format`
- `visual`

Valors: `insufficient_data`, `early_signal`, `developing_pattern`, `moderate_evidence`, `strong_pattern`.

### Realitat, autoritat i diversitat

- Un cas real rep prioritat davant un cas hipotètic equivalent.
- `authority_fit` pondera credibilitat contextual, però no garanteix rendiment.
- Es penalitza repetir la família anterior o superar dues aparicions en els últims quatre posts.
- Es penalitzen fórmules narratives recents com “No debería...”, “La persona decide” o “El sistema prepara”.

### Format

- Una idea: imatge o text.
- Passos, framework o checklist: document/carrusel.
- Producte real: captura o vídeo natiu curt.

El carrusel no rep prioritat automàtica sobre la imatge.

### Cadència

- `0`: cap candidata supera el llindar de valor i aprenentatge.
- `1`: hi ha una candidata sòlida o un experiment actiu.
- `2`: hi ha dues candidates fortes, de famílies diferents i amb puntuacions pròximes, sense experiment actiu.

## Experiment

Cada decisió conté:

- `hypothesis`
- `primary_variable`
- `controls`
- `confounders`
- `expected_signal`
- `measurement_windows`

La recomanació del 24/09 prova principalment `topic`: un cas comercial real. Manté LinkedIn, 08:40, franja 08–10, post amb imatge, estil visual baseline i CTA suau. Les finestres són 24 h, 72 h i 7 dies.

## Esquema de decisió

La resposta inclou:

- publicar o no i cadència setmanal;
- objectiu i objectiu d'aprenentatge;
- tema, família, cas real, hook i text;
- data, hora, slot, format, visual i CTA;
- experiment i quatre confiances;
- evidència traçable;
- mètriques i cicle de validació;
- alternatives, restriccions i advertències.

## Paper d'OpenAI

OpenAI pot sintetitzar, argumentar, generar variants de hook o text, comparar alternatives i debatre. Rep `canonicalState` i `deterministicDecision` automàticament a `/api/content-director`.

OpenAI no pot alterar mètriques, dates, estat publicat, maduració, confiança calculada, experiments actius ni restriccions. Les aprovacions i rebuigs només es registren mitjançant accions explícites.

Si el proveïdor no és accessible, l'API retorna `providerStatus: fallback_local` i manté operativa la resposta determinista. Això conserva l'experiència del dashboard, però no equival a haver validat una crida externa real.

## API i memòria

- `GET /api/content-decision`: decisió i estat canònic.
- `POST /api/content-decision/actions`: `approve`, `reject` o `regenerate_alternative`.
- `POST /api/content-director`: debat amb estat automàtic; accepta `conversationId` o `conversation_id`.
- Converses: `data/runtime/content-director-conversations.json`.
- Feedback i experiment aprovat: `data/runtime/editorial-control.json`.

Els fitxers runtime són escriptures atòmiques locals i no contenen secrets.

## Tests

`tests/unit/content-decision-engine.test.ts` cobreix:

- freshness precedence;
- guard de publicats;
- finestres de maduració;
- timing confidence;
- penalització narrativa;
- diversitat de famílies;
- una variable experimental principal;
- cadència 0/1/2;
- preferència per casos reals;
- advertències de qualitat;
- PM 110 → 267;
- aprovacions 64 → 76 sense concloure que la tarda és dolenta.

La suite existent també valida el report, el Director, OpenAI, dades reals, timing i absència de secrets al frontend.

## Limitacions conegudes

- La font operativa continua sent JSON; falta l'adapter Prisma per complir el flux de base de dades de producció.
- LinkedIn i Meta no tenen ingestió automàtica ni publicació connectada.
- Alguns posts antics només tenen valors rolling o dates incompletes; es conserven com a context, no com a cohorts comparables.
- No hi ha embeddings. El guard utilitza normalització i similaritat de tokens, suficient per al MVP però millorable amb més volum.
- Format, visual, dia i hora encara tenen mostra insuficient.
- Leads i reunions confirmats continuen a zero; el motor no converteix visites o invitacions en resultats comercials.
