# Desplegament a EasyPanel

Aquest document prepara un desplegament futur a EasyPanel; no fixa cap domini ni inclou secrets. L'arquitectura de producció recomanada és:

- un servei PostgreSQL persistent;
- un servei App web, exposat al port intern `3000`;
- un servei Worker sense domini públic;
- una execució explícita de migracions per cada versió que contingui canvis d'esquema;
- un proveïdor SMTP real, en lloc de Mailpit.

App i Worker utilitzen el mateix `Dockerfile` i la mateixa imatge. L'argument d'arrencada és `app`, `worker`, `migrate` o `seed`. Els PDFs es generen sota demanda, de manera que l'aplicació no necessita un volum de fitxers compartit.

Referències oficials: [App Service](https://easypanel.io/docs/services/app), [Dockerfile builders](https://easypanel.io/docs/builders) i [Database Backups](https://easypanel.io/docs/database-backups).

## 1. Preparar el servidor i el repositori

- Utilitza un servidor net compatible amb EasyPanel i mantén lliures els ports públics `80` i `443`.
- Connecta el repositori GitHub a EasyPanel.
- Desplega sempre una branca o commit identificable. No utilitzis una còpia local sense versionar.
- Verifica localment abans de publicar:

  ```bash
  npm ci
  npm run lint
  npm run typecheck
  npm run test
  npm run build
  docker build --target runner -t aimetos-crm:release .
  ```

## 2. Crear PostgreSQL

1. Dins del projecte d'EasyPanel, crea un servei PostgreSQL.
2. Genera usuari, contrasenya i nom de base de dades exclusius; no reutilitzis els valors locals.
3. Conserva el volum persistent que crea el servei.
4. Copia la URL de connexió interna que mostra EasyPanel. Aquesta URL és el valor de `DATABASE_URL` per a App, Worker i migracions.
5. No publiquis el port `5432` a Internet.
6. Configura còpies automàtiques a un bucket S3 compatible i prova una restauració. La funció integrada de backups depèn del pla d'EasyPanel; si no està disponible, programa `pg_dump` cap a emmagatzematge extern.

## 3. Variables de producció

Configura les mateixes variables a App i Worker. No pugis `.env` al repositori.

Obligatòries:

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://USUARI:CONTRASENYA@HOST_INTERN:5432/BASE?schema=public
DIRECT_DATABASE_URL=postgresql://USUARI:CONTRASENYA@HOST_INTERN:5432/BASE?schema=public
AUTH_SECRET=SECRET_ALEATORI_LLARG
AUTH_URL=https://DOMINI_FINAL
AUTH_TRUST_HOST=true
APP_URL=https://DOMINI_FINAL
ADMIN_EMAIL=administrador@domini.example
ADMIN_PASSWORD=CONTRASENYA_INICIAL_LLARGA
SEED_DEMO_DATA=false
MIGRATE_ON_START=false
SEED_ON_START=false
```

Genera `AUTH_SECRET` fora del repositori:

```bash
openssl rand -base64 48
```

SMTP recomanat:

```dotenv
SMTP_HOST=smtp.proveidor.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=USUARI_SMTP
SMTP_PASSWORD=SECRET_SMTP
SMTP_FROM_NAME=AImetos
SMTP_FROM_EMAIL=crm@domini.example
```

Opcional, només mode test durant la validació inicial de Stripe:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Altres valors operatius, com l'interval del worker i secrets HMAC dels webhooks sortints, també han de viure a les variables protegides d'EasyPanel. No copiïs a producció cap contrasenya per defecte de `docker-compose.yml`.

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` és pública però queda incorporada durant el build de Next.js. Afegeix-la també com a build argument del builder Docker d'EasyPanel. Canviar-la exigeix un build i desplegament nous; les claus secretes continuen sent exclusivament de runtime.

## 4. Crear el servei web

1. Afegeix un servei **App** amb origen GitHub.
2. Selecciona el builder **Dockerfile** i indica `Dockerfile` com a ruta. L'etapa final ja és `runner`.
3. A **Deploy settings**, deixa `app` com a command/argument d'arrencada, o conserva el `CMD` per defecte de la imatge.
4. Configura un sol contenidor durant la primera migració i seed.
5. Afegeix el domini quan estigui decidit i configura el proxy al port intern `3000`.
6. Estableix `/api/health` com a comprovació HTTP si el panell sol·licita una ruta de salut.
7. Desplega i comprova els logs abans d'activar auto-deploy.

EasyPanel configura el proxy i el certificat TLS quan s'associa un domini. No cal publicar manualment el port `3000` del servidor.

## 5. Aplicar migracions i seed inicial

Les migracions no s'executen implícitament en cada rèplica. Això evita carreres entre App i Worker.

Per al primer desplegament, amb **una sola rèplica web**:

1. Estableix temporalment:

   ```dotenv
   MIGRATE_ON_START=true
   SEED_ON_START=true
   SEED_DEMO_DATA=false
   ```

2. Abans de desplegar, defineix un `ADMIN_PASSWORD` únic, llarg i generat aleatòriament. El bootstrap l'aplica només quan crea l'admin; execucions posteriors no sobreescriuen la contrasenya existent.
3. Desplega App i comprova als logs que `db:migrate` (`prisma migrate deploy`) i `db:seed` acaben abans d'arrencar `server.js`.
4. Inicia sessió amb la contrasenya segura configurada i comprova `/api/health`.
5. Torna a establir `MIGRATE_ON_START=false` i `SEED_ON_START=false` i desplega de nou.

Per a versions posteriors, executa una migració explícita abans de canviar App i Worker:

- crea temporalment un servei App amb el mateix commit/Dockerfile i command `migrate`;
- comparteix exactament la mateixa `DATABASE_URL`;
- desplega'l i valida que finalitza amb codi `0` als logs;
- publica App i Worker només després de l'èxit;
- atura o elimina el servei temporal.

No executis `db:migrate:dev` en producció: aquesta comanda crea migracions de desenvolupament. Producció sempre utilitza `db:migrate`, que està definit com `prisma migrate deploy`, a través del rol `migrate`.

El seed només és necessari a la primera instal·lació. No activis `SEED_ON_START` de manera permanent.

## 6. Crear el Worker

1. Crea un segon servei **App** des del mateix repositori, commit i `Dockerfile`.
2. A **Deploy settings**, estableix el command/argument `worker`.
3. Copia les variables de l'App, incloent `DATABASE_URL`, SMTP, Stripe i secrets de webhooks.
4. No associïs cap domini ni port públic.
5. Comença amb una rèplica. El bloqueig transaccional de PostgreSQL permet escalar més endavant, però primer cal observar volum de jobs i connexions.
6. Revisa que els logs mostrin polling i graceful shutdown, sense reintents continus d'un mateix job.

## 7. Stripe i webhooks

Configura l'endpoint de Stripe en mode test:

```text
https://DOMINI_FINAL/api/webhooks/stripe
```

- Selecciona només els esdeveniments documentats pel CRM.
- Copia el signing secret a `STRIPE_WEBHOOK_SECRET`.
- Envia un esdeveniment de prova i verifica que queda registrat una sola vegada.
- No canviïs a claus live fins que Checkout, import, moneda, idempotència i conciliació estiguin validats.

Per als webhooks cap a n8n, utilitza HTTPS i un secret HMAC diferent per endpoint. El worker ha de poder arribar a n8n; n8n no necessita accés directe a PostgreSQL.

## 8. Correu

Mailpit és només per a desenvolupament i no es desplega a EasyPanel. Abans d'enviar correu real:

- verifica SPF, DKIM i DMARC del domini remitent;
- prova primer amb una adreça interna;
- comprova que els errors SMTP creen reintents al worker;
- no exposis `SMTP_PASSWORD` als logs.

## 9. Persistència i backups

- PostgreSQL és l'únic estat persistent imprescindible.
- No muntis volums per a `.next`, codi o dependències.
- Els PDFs es generen sota demanda; no cal sincronitzar fitxers entre App i Worker.
- Si en el futur s'afegeixen uploads persistents, utilitza object storage o un volum explícit compartit i documenta'n la restauració.
- Conserva backups fora del VPS i prova periòdicament la restauració en una base separada.

Abans d'una migració destructiva:

1. crea una còpia verificada;
2. revisa el SQL de la migració;
3. aplica-la amb el rol `migrate`;
4. comprova `/api/health`, login, formulari públic, worker i enviament de correu;
5. conserva una estratègia de rollback d'aplicació compatible amb l'esquema nou.

## 10. Checklist de publicació

- [ ] `lint`, `typecheck`, tests i build passen al commit desplegat.
- [ ] La imatge s'executa com a usuari no root.
- [ ] PostgreSQL té volum persistent i backup extern provat.
- [ ] Les migracions han acabat abans d'App i Worker.
- [ ] `SEED_DEMO_DATA=false` al desplegament real; `MIGRATE_ON_START=false` i `SEED_ON_START=false` després del bootstrap.
- [ ] App respon `200` a `/api/health`.
- [ ] Worker processa un job i no exposa cap port.
- [ ] El domini força HTTPS i `AUTH_URL`/`APP_URL` coincideixen amb el domini públic.
- [ ] No hi ha secrets locals ni claus Stripe live al repositori.
- [ ] SMTP real funciona i no és Mailpit.
- [ ] El webhook Stripe verifica signatures i idempotència.
- [ ] Els webhooks sortints estan signats i es reintenten fora del request web.
- [ ] L'admin s'ha creat des del primer bootstrap amb una contrasenya única i aleatòria.
