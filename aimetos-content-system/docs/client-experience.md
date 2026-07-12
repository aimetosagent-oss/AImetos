# AImetos Client Experience

Objectiu: que el client no hagi d'entrar a n8n ni pensar que publicar. El sistema ha de convertir dades del mes anterior en una decisio clara de contingut.

## Que veu el client

El client veu un informe mensual amb:

- Millor contingut del mes anterior.
- Format guanyador: post, reel, carrusel, imatge, article o newsletter.
- Canal recomanat: LinkedIn, Instagram, YouTube, blog o email.
- Per que ha funcionat.
- Que publicar ara.
- Hook, brief de produccio i CTA.
- Calendari de les properes setmanes.

## Com es prova ara

1. Obrir el dashboard local.
2. Revisar la decisio principal.
3. Entrar a "Millor contingut del mes" i comprovar si la recomanacio te sentit.
4. Revisar "Que publicar ara".
5. Validar si el client entendria que ha de fer sense veure n8n.

Endpoint local:

```text
GET /api/client-report
```

Workflow n8n principal:

```text
00_Client Monthly Content Report
```

Webhook n8n:

```text
/webhook/client-monthly-content-report
```

## Que no ha de fer el client

- No ha d'executar 28 workflows.
- No ha de llegir JSON tecnic.
- No ha de saber que es un webhook.
- No ha de decidir manualment quin contingut ha funcionat.

## Arquitectura practica

- `00_Client Monthly Content Report`: entrada unica per demo i experiencia de client.
- `01-28`: motor intern validat, reutilitzable quan calgui.
- Dashboard: vista de decisio.
- Google Sheet: font o sortida tabular per revisar dades i resultats.
- Drive: carpeta compartible amb el client.

## Fase demo

La fase demo usa dades mock del mes anterior. Serveix per validar:

- Experiencia de client.
- Valor comercial.
- Format de l'informe.
- Tipus de recomanacions.
- Conversa de venda.

## Fase produccio

Quan la demo agradi, es connecten credencials una a una:

1. Google Sheets com a font inicial de metriques.
2. OpenAI per generar copies, guions i prompts reals.
3. Meta/Instagram i LinkedIn per metriques reals.
4. Drive per entregar informes i assets.
5. CRM per leads i conversions.

Regla Toyota: cada integracio es valida, es deixa estable i no es toca mes si no hi ha defecte.

## Proposta comercial

Missatge simple:

> Cada mes t'entrego que ha funcionat, per que ha funcionat i que has de publicar ara per repetir el millor senyal.

Lliurables venibles:

- Informe mensual.
- Top contingut.
- Pla editorial.
- Guions de reels.
- Prompts visuals.
- Copies per LinkedIn/Instagram.
- Revisio de leads i conversions.

