# LinkedIn Leads SIMPLE + missatge

Workflow n8n mínim: llegeix input del Google Sheet, executa Apify, filtra/normalitza perfils, genera un missatge curt amb OpenAI i desa leads a `Leads`.

## Nodes

1. `Inici manual`
2. `Trigger setmanal`
3. `Llegir Input`
4. `Preparar cerca`
5. `Apify - buscar leads`
6. `Normalitzar leads`
7. `OpenAI - missatge`
8. `Unir lead i missatge`
9. `Preparar registre final`
10. `Guardar a Leads`
11. `Resum`

## Google Sheet

`https://docs.google.com/spreadsheets/d/1TQJGO7he2WAEyP67GpkD3ThT3bjeiVMhMdVlxGceRmA/edit`

El workflow llegeix `Input` i escriu a `Leads`. La fila `executar` no s'usa i no es modifica; pot quedar sempre en `SI` o ignorar-se.

## Apify

No cal credencial Apify a n8n. Usa variables EasyPanel:

`APIFY_TOKEN_CLIENT_01` ... `APIFY_TOKEN_CLIENT_08`

## OpenAI

El node `OpenAI - missatge` és HTTP Request. Selecciona la teva credencial Header Auth d'OpenAI existent. Si OpenAI falla, el workflow continua i posa un missatge fallback.

Prompt mínim actual: missatge LinkedIn en català, màxim 300 caràcters, professional, directe, no agressiu, enfocat en automatització i agents IA.

## Qualitat

La cerca ara és més restrictiva:

`"CEO" OR "Founder" ... "sector" "zona" "paraules_clau"`

I després marca qualitat sense descartar leads:

- si la ubicació no encaixa amb la zona, posa nota de revisió;
- si headline/càrrec/empresa no encaixen clarament amb sector/keywords/càrrecs, posa nota de revisió;
- no deixa el workflow sense output només pel filtre.
