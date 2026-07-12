# Architecture

The system is a modular monorepo with one deployable API, one worker, one dashboard and domain packages. It is intentionally mock-first. External integrations are selected through the connector registry and remain disabled until config enables them.

Key decisions:

- Use one repository and one runtime boundary before considering services.
- Keep the approved source article as the single source for all adaptations.
- Use deterministic mock fixtures for every workflow.
- Validate structured AI outputs before accepting them.
