# n8n Workflows

## Objective

Maintain an inventory of production workflows and their business responsibilities.

## Workflow record

Document name, purpose, owner, trigger, inputs, outputs, dependencies, retry behavior, and rollback path.

## Lifecycle

Draft, validate, review, publish, monitor, and retire workflows deliberately.

## Inventory

| Workflow | Status | Trigger | Purpose | Dependencies |
|---|---|---|---|---|
| `AImetos | MVP decisors LinkedIn` | MVP, manual | Manual Trigger | Collect decision-maker profiles, deduplicate, draft a manual LinkedIn message, and upsert to Google Sheets | Apify, OpenAI, Google Sheets |

Implementation and operating notes: [`workflows/linkedin-decision-makers-mvp/README.md`](../../workflows/linkedin-decision-makers-mvp/README.md).

## TODO

- Add workflow versioning procedure.
