# Import target

Remote folder:

```text
AImetos - Sistema automàtic XXSS
```

URL:

```text
https://demo-n8n.abrfjv.easypanel.host/projects/qPs35aFceg2hJGVR/folders/e5BkqzfSTudtzdHF/workflows
```

Project ID:

```text
qPs35aFceg2hJGVR
```

Folder ID:

```text
e5BkqzfSTudtzdHF
```

Import order:

1. Import subworkflows from `subworkflows/`.
2. Import workflows from `workflows/`.
3. Keep all workflows inactive until the first credential rollout.
4. Validate one workflow at a time.
5. Once a workflow works with its credential, freeze it and do not change it unless a defect is found.

Node naming convention:

```text
00_trigger
01_action
02_logging_or_next_step
```

All JSON files currently follow this convention.
