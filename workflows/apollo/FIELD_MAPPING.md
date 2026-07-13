# Field mapping

## LEADS input

El workflow pot operar si existeix almenys un identificador:

1. `company_domain`
2. domini extret de `company_website`
3. `company_name` + `company_city`

El domini es normalitza aixi:

- elimina `http://` i `https://`;
- elimina `www.`;
- elimina path, query string i barres finals;
- passa a minuscules;
- no dedueix dominis amb cerques externes.

## LEADS output

Quan hi ha coincidencia, el workflow actualitza:

- `decision_maker_name`
- `decision_maker_first_name`
- `decision_maker_last_name`
- `decision_maker_job_title`
- `decision_maker_seniority`
- `decision_maker_department`
- `decision_maker_email`
- `decision_maker_email_status`
- `decision_maker_phone`
- `decision_maker_linkedin_url`
- `apollo_person_id`
- `apollo_organization_id`
- `apollo_status`
- `apollo_error`
- `apollo_attempts`
- `apollo_last_checked_at`
- `processed_at`

També escriu `lead_id` si estava buit. El valor es deterministic i es basa en domini, nom d'empresa i ciutat.

## Emails

El workflow nomes desa emails retornats per Apollo o emails manuals ja existents al Sheet. No genera patrons com `nom.cognom@domini`.

`decision_maker_email_status` conserva literalment l'estat retornat per Apollo, per exemple:

- `verified`
- `likely_to_engage`
- `unverified`
- `unavailable`
- `catch_all`
- altres valors reals retornats per l'API

Si hi ha contacte pero no email:

- `apollo_status=matched_without_email`

## Seleccio determinista

Ordre de prioritat base:

| Role | Score |
| --- | ---: |
| Owner | 100 |
| Founder / Co-Founder | 95 |
| CEO | 90 |
| Managing Director | 85 |
| General Manager | 80 |
| Partner | 78 |
| COO / Operations Director | 75 |
| Commercial / Sales Director | 70 |
| Marketing Director | 65 |
| Head of Operations | 58 |
| Head of Sales | 56 |
| Head of Marketing | 54 |
| Director | 50 |
| Head | 45 |
| Manager | 40 |

Tie-breakers:

1. seniority superior;
2. email professional verificat o indicat per Apollo;
3. perfil actual;
4. major coincidencia amb domini;
5. primer resultat retornat per Apollo.

Exclusions:

- intern, student, assistant, trainee, junior;
- recruiter, excepte sectors de seleccio o recursos humans;
- perfils sense relacio amb direccio, compres, operacions, vendes o marketing;
- contactes que l'enriquiment indiqui que no treballen actualment a l'empresa.
