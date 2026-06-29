# AImetos System OS

## 1. Vision

AImetos is an AI-driven automation operating system for lead generation, enrichment, messaging, and operational control. It connects specialized agents, deterministic workflows, shared business data, and dashboards into one observable system.

The system is built for incremental delivery:

- **Minimal:** introduce only the components required by the current operation.
- **Modular:** isolate acquisition, decisions, messaging, orchestration, and presentation behind clear interfaces.
- **Scalable by evidence:** improve or separate components only when measured volume, cost, or reliability requires it.
- **Human-controlled:** require review where compliance, reputation, or commercial judgment matters.

GitHub is the source of truth for architecture, code, workflow definitions, and decisions. PostgreSQL is the operational source of truth for business state. n8n is the initial orchestration engine, not the database or business reporting layer.

### Current scope

The immediate product is an **internal outbound control system**: a dashboard and data model that make the existing 24/7 scraping and email operation visible, traceable, and controllable.

The following are intentionally deferred: a general-purpose CRM, a client portal, autonomous LinkedIn sending, multiple backend services, and enterprise-scale infrastructure.

## 2. System Modules

| Module | Responsibility | Initial implementation |
| --- | --- | --- |
| Lead acquisition | Ingest leads from scrapers, approved APIs, forms, and imports; retain source and consent/provenance data. | Existing outbound scraper through n8n, writing normalized records to PostgreSQL. |
| Enrichment | Normalize, deduplicate, validate, and append company, contact, and industry attributes. | Deterministic cleanup first; external enrichment and AI classification only when needed. |
| Decision | Select a vertical, offer, proposal template, channel, and approval policy from explicit rules. | Versioned sector-to-solution mapping with a confidence score and fallback. |
| Messaging | Generate and track email, LinkedIn drafts, and future channels without losing message history. | Email first; drafts and sends are separate states. WhatsApp remains future scope. |
| Automation engine | Schedule and coordinate jobs, retries, approvals, and integrations. | n8n workflows with stable identifiers and execution records. |
| Data | Preserve canonical operational state and relationships. | One PostgreSQL database with a simple relational schema. Avoid workflow-local shadow state. |
| Dashboard | Expose pipeline health, campaign outcomes, messages, replies, errors, costs, and controls. | Internal, read-heavy control panel; limited safe actions such as pause, retry, and approve. |
| Agents | Perform narrow, measurable AI-assisted tasks within defined tools and guardrails. | Specialized agents invoked by n8n; outputs are stored with model/version metadata. |

### Module boundaries

- n8n coordinates work but does not own canonical lead or campaign state.
- PostgreSQL stores facts and state transitions; agents do not update unrelated records directly.
- Agents propose classifications, content, or actions; deterministic workflows validate and apply them.
- The dashboard reads shared operational data and invokes controlled actions through an internal API or guarded n8n webhook.
- Every external input preserves its source, collection time, and applicable compliance metadata.

## 3. Priority Roadmap

Build phases are sequential by default. A phase is complete only when its exit criteria are met.

### Phase 1 — Internal outbound control plane (now)

**Outcome:** the team can understand and operate the existing outbound system from one place.

Build:

1. Define the minimum PostgreSQL entities and status vocabulary.
2. Adapt the existing scraper and email workflows to write leads, messages, executions, and errors consistently.
3. Backfill only the historical data needed for useful baselines.
4. Build an internal dashboard with:
   - lead and campaign pipeline views;
   - message and response history;
   - workflow run status and error details;
   - basic volume, reply, failure, and API-cost metrics;
   - safe pause, retry, and approval controls.
5. Add idempotency, bounded retries, error capture, and alerts to the active workflows.

Exit criteria:

- Every outbound message is traceable to a lead, campaign, and execution.
- Operators can identify failed runs and their causes without opening each n8n workflow.
- Duplicate processing is prevented by stable identifiers and idempotency rules.
- Dashboard counts reconcile with PostgreSQL queries for an agreed sample period.
- A failed or paused workflow cannot silently continue sending.

### Phase 2 — Dynamic proposal engine

**Outcome:** the system consistently maps a qualified lead to an appropriate, reviewable offer.

Build:

- A versioned `industry -> pain point -> solution -> proof -> call to action` mapping.
- Vertical templates, starting with the best-supported sectors such as HR, restaurants, and architecture.
- Structured proposal selection with confidence, reason, and fallback behavior.
- Message variants generated from approved facts and templates.
- Human approval for new verticals and low-confidence selections.

Exit criteria:

- Proposal decisions are reproducible from stored inputs and rule/template versions.
- Unsupported or uncertain sectors fall back to review rather than invented claims.
- Results can be compared by vertical, template version, and campaign.

### Phase 3 — Lead discovery and enrichment agents

**Outcome:** new lead sources can be added without changing downstream campaign logic.

Build:

- Source adapters with the same ingestion contract and provenance requirements.
- Specialized discovery, including the Grasshopper/niche technical lead use case.
- Deduplication, contact validation, qualification, and industry classification.
- Source-level quality, cost, and compliance reporting.

Exit criteria:

- Each source meets defined quality and cost thresholds before continuous operation.
- A lead can be traced to its original source and enrichment steps.
- Reprocessing is safe and does not create duplicate companies, leads, or messages.

### Phase 4 — Controlled LinkedIn assistance

**Outcome:** LinkedIn research and drafting improve operator productivity without unsafe autonomous behavior.

Build:

- Policy review of current LinkedIn terms and applicable privacy/marketing rules before implementation.
- Profile/lead research only through approved collection methods.
- Draft-first connection and message assistance.
- Approval queue, rate controls, audit trail, and kill switch.
- Sending remains manual or uses only an explicitly approved integration.

Exit criteria:

- No message is sent without the configured approval policy being satisfied.
- Collection and sending methods have a documented compliance owner and review date.
- Operators can stop all activity immediately and inspect a complete audit trail.

> LinkedIn automation can violate platform terms or create account and legal risk. AImetos must not use evasion, bypass access controls, or assume that technically possible automation is permitted.

### Phase 5 — Client-facing dashboard

**Outcome:** selected operational visibility becomes a secure, SaaS-like client experience.

Build only after internal workflows and metrics are stable:

- Tenant and user isolation.
- Role-based access and audit logs.
- Client-safe reports, approvals, and configuration.
- Usage/cost attribution and service boundaries.

Exit criteria:

- Tenant isolation is tested at the data and API layers.
- Internal details, prompts, errors, and other clients' data cannot leak into client views.
- Support ownership, backup, recovery, and service expectations are documented.

## 4. Conceptual Data Model

| Entity | Purpose | Key relationships and attributes |
| --- | --- | --- |
| Companies | Canonical organization record. | Domain and identity keys; industry; location; has many leads and tags. |
| Leads | A contact or opportunity associated with a company. | Source/provenance, qualification, owner, consent basis, lifecycle status; belongs to a company. |
| Campaigns | Defines an outbound initiative and its targeting/configuration. | Channel, audience rules, offer/template versions, active/paused status; has many leads and messages. |
| Messages | Immutable communication attempt or draft. | Lead, campaign, channel, content/version, approval state, delivery state, timestamps, provider ID. |
| Responses | Inbound reply or classified outcome. | Related message and lead; raw reference, sentiment/intent, classification confidence, received time. |
| Agents | Registry of specialized AI behavior. | Purpose, prompt/config version, model, allowed tools, active status, owner. |
| Executions | One n8n workflow or agent run. | Workflow/agent, correlation ID, input/output references, status, timing, retry count, error. |
| Costs | Usage attributed to a run or business object. | Provider, service/model, units, amount, currency, execution/campaign, timestamp. |
| Tags | Controlled labels for segmentation and classification. | Name, type, version/source; many-to-many with companies, leads, and campaigns. |

### Shared conventions

- Use stable internal IDs; keep third-party IDs as external references.
- Store UTC timestamps and present them in the operator's timezone.
- Use controlled status values and append status history for material transitions.
- Keep generated content, classification reason, confidence, and configuration version together.
- Prefer soft deactivation or retention policies to destructive deletion; honor legal deletion requirements explicitly.
- Separate business records from raw provider payloads, which should be retained only when useful and permitted.

## 5. Agent Types

| Agent | Input | Output | Guardrail / measure |
| --- | --- | --- | --- |
| Lead scraper agent | Approved source and search criteria. | Candidate leads with provenance. | Source policy, rate limit, deduplication; accepted-lead rate. |
| Lead classifier agent | Normalized lead and company data. | Industry, fit, tags, confidence, reason. | Controlled taxonomy and review threshold; classification accuracy. |
| Message generator agent | Lead facts, approved offer, and template. | Structured message draft and rationale. | No invented claims; approval policy; edit and reply rates. |
| Campaign optimizer agent | Aggregated campaign outcomes. | Suggested targeting or template changes. | Suggestion-only initially; minimum sample size; measured uplift. |
| Error monitoring agent | Failed/stalled executions and system signals. | Categorized incident, context, and proposed action. | Redact sensitive data; bounded auto-retry; detection time. |
| Reporting agent | Validated operational metrics. | Periodic narrative summary and anomalies. | Metrics come from queries, not model estimates; reconciliation rate. |

Agents are narrow capabilities, not independent owners of business state. Each invocation must be attributable to an agent/configuration version and execution. High-impact actions require explicit deterministic checks or human approval.

## 6. System Flow

```text
Approved sources
      |
      v
Lead acquisition -> Normalize / deduplicate -> Enrich -> Classify
                                                    |
                                                    v
                                      Select proposal + channel
                                                    |
                                                    v
                                           Generate message
                                                    |
                                                    v
                                  Approval (when policy requires)
                                                    |
                                                    v
                                          Send -> Track response
                                                    |
                                                    v
                                  PostgreSQL -> Internal dashboard
```

At every step, n8n creates or updates an execution record with a correlation ID. Failures move to an explicit retry, review, or terminal state; they do not disappear. The dashboard reports from canonical data and exposes only guarded operational controls.

### Minimum lifecycle

```text
Lead:    discovered -> enriched -> qualified -> queued -> contacted -> replied
                                   |                         |
                                   v                         v
                              disqualified              no_response

Message: draft -> pending_approval -> approved -> queued -> sent -> delivered
              |             |                      |          |
              v             v                      v          v
          rejected       expired                failed     bounced
```

Status names should remain few, explicit, and shared across n8n, PostgreSQL, and the dashboard.

## 7. Design Principles

1. **Solve the current bottleneck.** Phase 1 visibility and control take priority over new acquisition channels.
2. **Keep the architecture boring.** Begin with PostgreSQL, n8n, and one internal dashboard; add services only for a measured reason.
3. **Make work visible.** Track inputs, outputs, decisions, costs, state transitions, and failures with correlation IDs.
4. **Fail safe.** Default to no-send on missing data, uncertain policy, exhausted retries, or unavailable dependencies.
5. **Design for idempotency.** Replaying a workflow must not duplicate leads or outbound messages.
6. **Put humans at risk boundaries.** Use approval for uncertain classifications, new messaging strategies, and restricted channels.
7. **Separate facts from generated suggestions.** Preserve source data and make AI-derived fields identifiable and reviewable.
8. **Standardize before automating.** Use shared schemas, statuses, and contracts before adding more agents.
9. **Improve from evidence.** Change prompts, templates, and workflows through versioned experiments with defined measures.
10. **Build quality into the flow.** Stop and surface defects near their source instead of repairing silent downstream damage.

## 8. Immediate Next Decisions

Phase 1 implementation should begin only after these small contracts are documented:

- Lead and message status vocabulary.
- Required fields and unique keys for the minimum data model.
- Existing n8n workflow inventory and ownership.
- Dashboard metrics with exact query definitions.
- Retry, alert, pause, and approval policies.
- Data retention and access expectations.

These decisions belong in focused documents or architecture decision records as implementation begins. This System OS remains the stable system boundary and priority guide; it should not become a catalogue of low-level workflow details.
