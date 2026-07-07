# Operació

- Executa el detector tres vegades per setmana: dilluns, dimecres i divendres a les 08:30 `Europe/Madrid`.
- Revisa els leads A dins de les 24 hores.
- No contactis leads C.
- Usa només missatges basats en evidència pública concreta.
- No creïs sortida automàtica.
- Revisa `04_RUN_LOG` després de cada execució durant la primera setmana.
- Si una font Apify falla, desactiva-la a `00_CONFIG.APIFY_SOURCES_JSON` en lloc de canviar codi del workflow.

## Rutina recomanada

1. Mira `04_RUN_LOG`.
2. Filtra `03_LEADS_CUALIFICADOS` per `priority=A`.
3. Verifica `source_url` i `pain_summary`.
4. Busca decisor manualment a Sales Navigator.
5. Completa `decision_maker_name`, `decision_maker_role` i `linkedin_url`.
6. Canvia `lead_status` a `Validated`.
7. Executa `GH Compute — Outreach Drafts`.
8. Revisa `05_OUTREACH_DRAFTS`.
9. Envia manualment només si el missatge és correcte i suportat per evidència.
