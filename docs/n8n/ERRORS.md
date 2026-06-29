# n8n Error Handling

## Objective

Define predictable detection, recovery, and escalation for workflow failures.

## Error policy

Classify errors as retryable, non-retryable, validation, dependency, or unknown. Bound retries and make side effects idempotent.

## Incident record

Capture workflow, execution ID, timestamp, sanitized context, impact, owner, and resolution.

## TODO

- Define alert channels, dead-letter handling, and escalation targets.
