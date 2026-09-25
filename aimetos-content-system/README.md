# AImetos Content System

Mock-first automated content and digital strategy system for AImetos.

This repository is prepared to run without real credentials. In `APP_MODE=mock`, every connector uses deterministic fixtures, controlled scenarios and structured logs. Real connectors are present, typed and documented, but return controlled credential errors until their environment variables are enabled.

## Quick start

```bash
pnpm run validate
pnpm run dev
```

The local API serves the dashboard and the mock endpoints at [http://localhost:4317](http://localhost:4317).

The separate agent operations dashboard is documented in `docs/agent-activity.md` and runs independently from the social content dashboard.

## Director de contingut

The content dashboard includes a closed-by-default conversation drawer. It builds selective context from the real dashboard report, keeps up to 30 local conversations in the ignored `data/runtime` directory and runs without credentials in `CHAT_PROVIDER=mock` mode.

To enable the server-side OpenAI provider, set `CHAT_PROVIDER=openai`, `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. The browser never receives the API key. `prompts/content-director.md` is the single source of behavioral instructions for both providers.

The same backend Responses API client powers `POST /api/editorial-report`. This endpoint creates a structured editorial synthesis from the current deterministic report; it never reads chat history and falls back to the deterministic result if OpenAI is unavailable or returns invalid JSON. The report-specific instructions live in `prompts/editorial-report.md`.

Manual checks:

```bash
curl -X POST http://127.0.0.1:4317/api/content-director -H "content-type: application/json" -d '{"message":"Quina publicació ha tingut més abast?"}'
curl -X POST http://127.0.0.1:4317/api/editorial-report
```

## LinkedIn automatic ingestion

PAS 3 adds official LinkedIn OAuth, post analytics, follower snapshots and an idempotent 24 h / 72 h / 7 day sync. Existing exports remain `manual_export`; official data is stored separately as `linkedin_api` and flows into the same Content Decision Engine.

The integration is ready to connect but requires LinkedIn Community Management approval. Follow [docs/LINKEDIN_API_SETUP.md](docs/LINKEDIN_API_SETUP.md); no scraping, browser automation or auto-publishing is used.

## Main flow

```text
Mock data -> analysis -> 5 ideas -> prioritization -> selection -> approval
-> article -> LinkedIn -> adaptations -> scheduling -> mock publishing
-> metrics -> report
```

## Structure

- `apps/api`: local HTTP API, health checks and dashboard static serving.
- `apps/dashboard`: operational dashboard assets and Next-compatible screen skeleton.
- `apps/worker`: scheduled worker entrypoint for mock runs.
- `packages/core`: workflow orchestration, state machine and audit events.
- `packages/analytics`: 30/90/historical weighted performance analysis.
- `packages/strategy`: idea generation, scoring and selection.
- `packages/content`: article, LinkedIn and multichannel adaptation generation.
- `packages/publishing`: schedule and mock publication logic.
- `packages/connectors`: mock and real connector registry.
- `packages/database`: Prisma schema, SQL migration and seed entrypoint.
- `automation/n8n`: importable workflows and reusable subworkflows.
- `data/fixtures`: realistic mock metrics, leads, campaigns and errors.
- `docs`: operating documentation and credential rollout.

## No secrets

Do not commit credentials. Use `.env.example` as the contract and activate integrations progressively as documented in `docs/credentials-rollout.md`.
