# AImetos Content System

Mock-first automated content and digital strategy system for AImetos.

This repository is prepared to run without real credentials. In `APP_MODE=mock`, every connector uses deterministic fixtures, controlled scenarios and structured logs. Real connectors are present, typed and documented, but return controlled credential errors until their environment variables are enabled.

## Quick start

```bash
pnpm run validate
pnpm run dev
```

The local API serves the dashboard and the mock endpoints at [http://localhost:4317](http://localhost:4317).

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
