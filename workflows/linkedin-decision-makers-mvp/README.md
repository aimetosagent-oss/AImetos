# MVP decisors LinkedIn: Apify → OpenAI → Google Sheets

Versió mínima funcional per cercar perfils, normalitzar-los, deduplicar-los, proposar un missatge de menys de 300 caràcters i desar-los a Google Sheets. No inicia sessió a LinkedIn i no envia cap missatge.

## Fitxers

- `linkedin_decision_makers_mvp.n8n.json`: workflow importable a n8n.
- `../../outputs/linkedin_decision_makers_mvp/AImetos_LinkedIn_Leads_MVP.xlsx`: plantilla del full, importable a Google Sheets.

## Nodes

1. **Inici manual**: arrenca l'execució sota control humà.
2. **Entrada i configuració**: sector, zona, càrrecs, paraules clau, límit i IDs.
3. **Validar input**: valida camps, limita l'MVP a 100 resultats i normalitza llistes/URLs.
4. **Executar actor Apify**: inicia `harvestapi/linkedin-profile-search` o l'actor compatible indicat.
5. **Consultar estat Apify**: espera fins a 60 segons i repeteix mentre la run sigui activa.
6. **Recuperar dataset Apify**: llegeix el dataset separat quan la run acaba.
7. **Netejar i deduplicar**: adapta variants del payload i deduplica per URL; com a segon criteri, nom + empresa.
8. **OpenAI - generar missatge**: crida la Responses API per cada lead. Si falla, el pas següent aplica un missatge de reserva.
9. **Google Sheets - desar leads**: `append or update` per ID estable; evita duplicats entre execucions.
10. **Resum final**: retorna recompte, run d'Apify i enllaç al full.

## Columnes del full

La pestanya s'ha d'anomenar `Leads` i la fila 1 ha de tenir, en aquest ordre:

`ID`, `Data captura`, `Sector`, `Zona`, `Nom`, `Càrrec`, `Empresa`, `URL LinkedIn`, `Ubicació`, `Headline`, `Estat lead`, `Missatge LinkedIn suggerit`, `Notes`, `Font`, `Duplicat?`, `Última actualització`.

`Estat lead` i `Notes` no s'actualitzen des del node d'n8n. Així, una reexecució pot refrescar les dades i el missatge sense esborrar el seguiment manual.

## Variables i credencials

| Placeholder | On s'omple | Valor |
|---|---|---|
| `APIFY_API_TOKEN` | Credencial n8n **HTTP Header Auth** | Name: `Authorization`; Value: `Bearer <token>` |
| `OPENAI_API_KEY` | Credencial n8n **HTTP Header Auth** | Name: `Authorization`; Value: `Bearer <api-key>` |
| `GOOGLE_SHEETS_CREDENTIALS` | Credencial n8n **Google Sheets OAuth2 API** | Compte amb accés d'edició al full |
| `APIFY_ACTOR_ID` | Node **Entrada i configuració** | Recomanat: `harvestapi~linkedin-profile-search` |
| `GOOGLE_SHEET_ID` | Node **Entrada i configuració** | ID del document o URL completa |

El model per defecte és `gpt-5-mini` i també es pot canviar al node d'entrada. El nom de la pestanya per defecte és `Leads`.

## Posada en marxa

1. Obre la plantilla `.xlsx` i importa-la a Google Sheets (`Fitxer → Importa`) o crea un full amb les 16 capçaleres exactes. Confirma que la pestanya és `Leads`.
2. A n8n, importa `linkedin_decision_makers_mvp.n8n.json`.
3. Crea les dues credencials **HTTP Header Auth**. En totes dues el camp Name és `Authorization`; al Value posa `Bearer ` seguit del token corresponent.
4. Crea o selecciona la credencial OAuth2 de Google Sheets i concedeix accés al document.
5. Obre els tres nodes amb credencials i selecciona `APIFY_API_TOKEN`, `OPENAI_API_KEY` i `GOOGLE_SHEETS_CREDENTIALS`.
6. Al node **Entrada i configuració**, posa `APIFY_ACTOR_ID` i `GOOGLE_SHEET_ID`. Per la primera prova usa l'actor recomanat i `limit_resultats = 5`.
7. Edita `sector`, `zona`, `carrecs_objectiu` i `paraules_clau`. Els càrrecs i paraules clau admeten valors separats per coma, punt i coma o salt de línia.
8. Prem **Execute workflow**. Revisa el node **Resum final** i després el full.
9. Revisa manualment perfil, encaix i missatge. El contacte a LinkedIn és sempre manual.

## Comportament i límits de l'MVP

- L'actor recomanat no demana cookies ni credencials de LinkedIn. Treballa amb perfils disponibles per al proveïdor, però és un actor de comunitat: preu, esquema i disponibilitat poden canviar.
- El mode `Full` prioritza càrrec, empresa, ubicació i headline; consumeix més crèdit que `Short`. `takePages` limita el nombre de pàgines i `maxItems` limita resultats/cost per run.
- El workflow tolera noms de camps habituals d'altres actors, però un actor alternatiu ha d'acceptar com a mínim `searchQuery`, `locations`, `currentJobTitles` i `maxItems`, o cal adaptar el body.
- La deduplicació dins la run prioritza la URL canònica de LinkedIn i després nom + empresa. Entre runs, Google Sheets fa upsert per un ID determinista.
- El missatge queda truncat de forma defensiva a 300 caràcters. Pot contenir errors de context; cal revisar-lo abans d'usar-lo.
- Si no hi ha resultats, no s'escriu cap fila. Revisa filtres i la run a Apify.
- Excel és la plantilla/format d'intercanvi. El workflow escriu a Google Sheets; el full es pot baixar després com `.xlsx`.

## Riscos i ús responsable

- Verifica les condicions de LinkedIn, Apify i de l'actor abans de producció. No hi ha cap garantia que un actor de tercers mantingui el mateix contracte.
- Tracta nom, ocupació, ubicació i URL com dades personals: defineix base jurídica, minimització, retenció, control d'accés i procés d'oposició/supressió segons el territori aplicable.
- Dada pública no equival a consentiment per fer spam. Segmenta, limita volum i freqüència, contacta només quan hi hagi encaix clar i registra l'oposició.
- No hi ha login automatitzat, evasió de controls, enviament de missatges, Instantly, Apollo ni dashboard en aquest MVP.

## Prova d'acceptació mínima

Input recomanat: sector `SaaS B2B`, zona `Barcelona, Spain`, càrrecs `CEO, Founder, COO`, paraules clau `automatització`, límit `5`. L'èxit és obtenir fins a 5 files úniques amb URL, dades professionals i missatge suggerit, sense cap enviament automàtic.

## Referències tècniques

- Apify API v2: `https://docs.apify.com/api/v2`
- Actor recomanat i esquema: `https://apify.com/harvestapi/linkedin-profile-search`
- Google Sheets node: `https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/`
- OpenAI Responses API: `https://platform.openai.com/docs/api-reference/responses/create`
