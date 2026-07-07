# Apollo opcional

Apollo és un mòdul aïllat. El workflow principal funciona sense `APOLLO_API_KEY`, sense endpoint Apollo i amb `APOLLO_ENABLED=FALSE`.

## Condicions obligatòries

El workflow 02 només processa una fila si totes aquestes condicions són certes:

- `APOLLO_ENABLED` és exactament `TRUE` a `00_CONFIG`.
- `APOLLO_API_KEY` existeix a les variables d'entorn de n8n.
- `APOLLO_ENRICH_ENDPOINT` existeix a les variables d'entorn de n8n.
- `decision_maker_name` té valor.
- `decision_maker_role` té valor.
- `email` està buit.
- `score` és com a mínim 65.
- `enrichment_status` és `Pending`.

## Camps que pot modificar

- `email`
- `email_source`
- `enrichment_status`
- `updated_at`

No modifica empreses, senyals, puntuació, prioritat, estat comercial ni esborranys. No envia cap outreach.

## Com activar

1. Configura `APOLLO_API_KEY` a l'entorn n8n.
2. Configura `APOLLO_ENRICH_ENDPOINT` a l'entorn n8n.
3. Reinicia n8n.
4. Canvia `APOLLO_ENABLED` a `TRUE` a `00_CONFIG`.
5. Executa manualment `GH Compute — Apollo Optional Enrichment`.
6. Revisa només els camps d'enriquiment actualitzats.

## Com desactivar

Canvia `APOLLO_ENABLED` a `FALSE`. El workflow registrarà `Skipped` i sortirà netament.
