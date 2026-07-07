# Procés d'outreach

El sistema només genera esborranys. L'enviament sempre és manual.

## Requisits abans de generar

- `priority` és `A` o `B`.
- `lead_status` és `Validated`.
- `decision_maker_name` i `decision_maker_role` tenen valor.
- `outreach_status` és `Pending`.

## Canal

- Si `email` està buit, el canal per defecte és `LinkedIn`.
- Si `email` té valor, el canal per defecte és `Email`.

## Regles del missatge

El missatge es genera en castellà, menciona una senyal pública concreta, evita claims no suportats i fa una pregunta simple de permís. Ha d'usar llenguatge condicional com:

- `Es posible que...`
- `En equipos con este tipo de flujo...`

No pot usar `HPC`, `cloud computing`, `AI transformation` ni frases com `somos los mejores`.

## Revisió manual

1. Obre `05_OUTREACH_DRAFTS`.
2. Verifica `evidence_used` contra `source_url`.
3. Edita el missatge si cal.
4. Envia manualment a LinkedIn o email.
5. Marca `status` com `Sent manually`.
6. Marca `outreach_status` del lead com `Sent manually`.
