# AImetos

AImetos Platform is a B2B AI automation platform for building and operating AI agents, customer workflows, CRM integrations, dashboards, and supporting APIs. This repository is the single source of truth for product documentation and will host backend, frontend, automation, and testing assets as the platform evolves.

## Principles

- Keep solutions simple, robust, observable, and easy to maintain.
- Document decisions before adding implementation complexity.
- Never commit secrets, credentials, customer data, or environment-specific values.
- Prefer small, reversible changes with clear ownership.

## Repository areas

- `docs/`: product, engineering, integration, and operations documentation.
- `backend/`: future backend services.
- `frontend/`: future user-facing applications.
- `workflows/`: future versioned workflow exports and definitions.
- `scripts/`: future maintenance and automation scripts.
- `tests/`: future automated validation.

## Documentation index

### Core

- [Setup](docs/01_SETUP.md)
- [Workflow](docs/02_WORKFLOW.md)
- [Project rules](docs/03_PROJECT_RULES.md)
- [Architecture](docs/04_ARCHITECTURE.md)
- [Deployment](docs/05_DEPLOYMENT.md)
- [Prompts](docs/06_PROMPTS.md)

### n8n

- [Workflows](docs/n8n/WORKFLOWS.md)
- [Nodes](docs/n8n/NODES.md)
- [Conventions](docs/n8n/CONVENTIONS.md)
- [Errors](docs/n8n/ERRORS.md)
- [Variables](docs/n8n/VARIABLES.md)

### CRM

- [GoHighLevel](docs/crm/GHL.md)
- [Pipelines](docs/crm/PIPELINES.md)
- [Custom fields](docs/crm/CUSTOM_FIELDS.md)
- [Automations](docs/crm/AUTOMATIONS.md)

### Dashboard

- [Metrics](docs/dashboard/METRICS.md)
- [Database](docs/dashboard/DATABASE.md)
- [Reports](docs/dashboard/REPORTS.md)

### AI agents

- [Receptionist](docs/agents/RECEPTIONIST.md)
- [Sales](docs/agents/SALES.md)
- [WhatsApp](docs/agents/WHATSAPP.md)
- [Voice](docs/agents/VOICE.md)
- [Email](docs/agents/EMAIL.md)

### APIs

- [OpenAI](docs/api/OPENAI.md)
- [Retell](docs/api/RETELL.md)
- [Evolution](docs/api/EVOLUTION.md)
- [Google](docs/api/GOOGLE.md)
- [Apify](docs/api/APIFY.md)

## Status

Documentation scaffold initialized. Implementation details remain intentionally open until requirements and architecture decisions are approved.
