# Connectors

Every connector exposes `validateConfig`, `execute` and `healthCheck`. Disabled integrations use mock connectors. Enabled integrations validate required environment variables and return controlled credential errors until rollout approval.
