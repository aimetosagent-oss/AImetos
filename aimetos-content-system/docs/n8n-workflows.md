# n8n workflows

`automation/n8n/workflows` contains the client-facing `00_Client Monthly Content Report` workflow plus the numbered operational workflows from `09` to `28`.

`automation/n8n/subworkflows` contains reusable blocks from `01` to `08`: authentication, validation, transformation, logging, errors, retries, notifications and audit.

For demos and client validation, use `00_Client Monthly Content Report` first. The other workflows are internal building blocks and should not be executed manually one by one unless a technical defect is being diagnosed.
