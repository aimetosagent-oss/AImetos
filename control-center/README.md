# AImetos Control Center

Dashboard independent i de només lectura per veure agents n8n, leads unificats, projectes, hores Clockify, finances i XXSS.

## Arrencada local

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Defineix `CONTROL_CENTER_PASSWORD` i `AUTH_SECRET`. La ruta `/demo` sempre funciona amb dades de mostra anonimitzades; la vista privada marca com a no disponible qualsevol font que encara no tingui credencials.

## Fonts

- Google Sheets: un compte de servei amb permís de lectura sobre cada full.
- n8n: URL de la instància i API key. Només es fan peticions `GET`.
- Clockify: API key, workspace i usuari. El pla gratuït permet 30 peticions per hora; la memòria cau és de cinc minuts.
- Finances: la [còpia nativa de Google Sheets](https://docs.google.com/spreadsheets/d/18IK5PFiJtgdvWCCDWXOlB2bfajMyoMf_G-Xlp80LR0E/edit) ja està creada i el seu ID és a `.env.example`.

Per al recompte de projectes finalitzats la setmana anterior, el full de projectes ha de tenir una columna `DATA FINALITZACIÓ` (configurable amb `PROJECT_COMPLETION_DATE_HEADER`). Si no existeix, el dashboard mostra el buit de dades en lloc d'inventar el valor.

## EasyPanel

1. Crea un servei des d'aquest directori (`control-center/`).
2. Utilitza el `Dockerfile` i publica el port `3000`.
3. Afegeix les variables de `.env.example` com a secrets.
4. Configura el domini i HTTPS.

El mode demostració és `/demo` i requereix la mateixa autenticació. Anonimitza noms de projectes, agents, imports i enllaços operatius.
