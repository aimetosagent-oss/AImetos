# Producció CRM AImetos

Prioritat del 24 de novembre de 2026: pipeline manual operatiu. Aquesta guia
substitueix les instruccions de bootstrap antigues de DEPLOY_EASYPANEL.md.
No executar cap ordre contra control-center, n8n, web, dashboards, Evolution API
ni les seves bases. No usar el docker-compose local en aquest VPS.

## 1. Accés i capacitat abans de crear serveis

Accés EasyPanel confirmat: `http://72.62.31.48:3000/`. El 24/11 el panell
mostra 4 cores, CPU 0,3%, RAM 1,9/15,6 GB i disc 20,6/192,7 GB. No s'han
canviat DNS ni desplegat serveis. SSH i Hostinger DNS encara no estan validats.

La nova decisió de l'usuari és afegir serveis independents dins
`aimetos-control-center`, sense canviar-ne el nom ni tocar control-center.
El límit de tres projectes ja no exigeix despesa. crm-app i crm-worker estan
creats però no desplegats. crm-postgres està creat i arrencat, encara sense esquema CRM.
Accés HTTPS autenticat: https://abrfjv.easypanel.host/.
SSH ha refusat la clau disponible; cal accés segur al host per cron i rclone.
No introduir secrets mitjançant l'accés HTTP a la IP.

Al terminal del VPS, només lectura:

```sh
free -h
df -h / /var/lib/docker
docker stats --no-stream
docker service ls
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Guardar el recompte de serveis i estat previ. Com a marge inicial reservar
aproximadament 2 GB RAM per runtime i 2 GB addicionals durant el build, i almenys
5 GB de disc lliure més l'espai de backups. Són pressupostos orientatius, no
recursos mesurats. Si no hi ha marge, no desplegar ni reiniciar altres serveis.

## 2. Codi i aïllament

- Repositori CRM: https://github.com/aimetosagent-oss/AImetos.git.
- Crear branca dedicada `codex/crm-production` des de la branca de treball
  validada. Incloure exclusivament els canvis CRM i prerequisits de robustesa;
  no afegir els canvis locals d'aimetos-content-system.
- Fer commit i push només després de revisar `git diff --cached --name-status`.
  Release publicada: 7e7bb669a3543f6bbbe525ff839ecf1fa553f567. Cap SHA desplegat encara.
- No publicar `main` sense distingir els canvis del Control Center. No tocar
  la seva font, branca, webhook de desplegament ni credencials.
- Revisar també l'auditoria npm de la release: el 24/11 resten advisories a la
  cadena CLI de Prisma 6 (inclosa a la imatge per a migracions) i al paquet
  baseline-browser-mapping. Cal resoldre o acceptar explícitament el risc abans
  de l'exposició pública; no s'ha ocultat ni fet cap actualització major aquí.
- En EasyPanel usar **aimetos-control-center** com a projecte intern.
  Crear només **crm-postgres**, **crm-app**, **crm-worker**. No alterar el
  servei **control-center**, la seva font, dominis, credencials o volum.
- App i worker: mateix commit, branca `codex/crm-production`, build context
  arrel `/`, Dockerfile `Dockerfile`, sense buildpacks ni subdirectori del
  Control Center. Desactivar auto-deploy inicialment.

## 3. PostgreSQL persistent independent

Postgres 16 creat amb nom de servei `crm-postgres`, base `aimetos_crm`, usuari
`crm_app` i contrasenya generada per EasyPanel. Conservar el muntatge verificat
`/etc/easypanel/projects/aimetos-control-center/crm-postgres/data` sobre
`/var/lib/postgresql/data`. Port exposat verificat a 0. No recrear el servei.
Copiar la URL **interna** que mostra el panell per a DATABASE_URL i
DIRECT_DATABASE_URL. No copiar la connexió local del port 51214.

## 4. Variables i arrencada privada

Copiar els noms i valors de `docker/production.env.example` a **Entorno** de
crm-app i crm-worker. Substituir només els tres placeholders de secrets/URL.
No reutilitzar CONTROL_CENTER_PASSWORD. Per generar AUTH_SECRET al VPS:

```sh
openssl rand -base64 48
```

ADMIN_PASSWORD: contrasenya independent de 20 caràcters o més, desada al gestor
de contrasenyes. ADMIN_EMAIL=aimetos.agent@gmail.com.
Comprovar la cadena real de proxies abans de fixar AUTH_TRUSTED_PROXY_HOPS=1;
amb Traefik directe al servei és un salt. No afegir Cloudflare proxy ara.

Abans del primer Deploy, **eliminar el domini automàtic del servei**, no crear
domini públic encara i no mapar ports del host. El panell pot generar un domini
automàtic als serveis App. Mantenir una rèplica cadascun.

1. Crear execució temporal amb la mateixa imatge i variables: ordre `migrate`.
   Ha d'acabar amb codi 0. Mai reset, db push ni migrate dev.
2. Sobre la mateixa versió executar una sola vegada ordre `bootstrap`.
   Crea només organització, dades fiscals, admin i 12 etapes; cap contacte,
   empresa, oportunitat, formulari, factura ni pressupost fictici. Si ja existeix
   l'organització, no la reescriu.
3. crm-app: ordre/arguments `app`, port intern 3000, health HTTP `/api/health`.
4. crm-worker: ordre/arguments `worker`, sense domini. Health command
   `node scripts/worker-health.mjs`. La marca només es renova després de
   consultar la base. No iniciar SMTP ni Stripe.
5. Límits inicials orientatius: app 768 MB, worker 384 MB, Postgres 512 MB.
   Revisar consum real; no aplicar cap límit als serveis existents.

## 5. Backup diari extern a Google Drive

Decisio: mantenir el sistema existent, no instal·lar Duplicati.

| Criteri | Scripts, pg_dump, cron i rclone | Duplicati |
| --- | --- | --- |
| Dump consistent | Ja implementat amb pg_dump | Encara necessitaria generar pg_dump |
| Operacio | Cron i logs simples, sense servei permanent nou | Interficie propia i configuracio persistent addicional |
| Xifrat i Drive | rclone crypt sobre carpeta dedicada | Alternativa amb configuracio i credencials propies |
| Recuperacio | pg_restore estandard, pendent prova externa real | Tampoc evita la prova de restauracio PostgreSQL |
| Recursos/cost | Execucio puntual, 0 EUR addicionals | Un servei mes; no s'ha demostrat millora necessaria |

No s'han muntat dos sistemes. [rclone crypt](https://rclone.org/crypt/) xifra
abans de pujar i desxifra en recuperar. Cal guardar contrasenya i salt fora del
VPS. [Duplicati](https://docs.duplicati.com/) no s'ha instal·lat: no aporta una
millora demostrada en aquest cas que compensi el servei i accessos addicionals.

No requereix contractar un servei. Usar rclone amb compte Drive autoritzat i
una carpeta privada exclusiva `AImetos-CRM-Backups`. Cal capacitat disponible.
Configurar `drive-crm` amb scope `drive.file` per limitar els fitxers accessibles
a l'aplicació i configurar `crm-backups` de tipus **crypt** damunt
`drive-crm:AImetos-CRM-Backups`. Guardar la clau de xifrat també fora del VPS,
al gestor de contrasenyes; sense ella el backup no és recuperable.

Executar `rclone config`: crear remote `drive-crm`, tipus `drive`, scope
`drive.file`, autoritzar el compte i no seleccionar shared drive. Crear després
remote `crm-backups`, tipus `crypt`, ruta `drive-crm:AImetos-CRM-Backups`,
xifrat de noms `standard` i directoris xifrats. Guardar contrasenya i salt nous
al gestor. En VPS sense navegador seguir el procés headless indicat per rclone
amb `rclone authorize drive` a l'ordinador local. No publicar la carpeta.

Fonts: [rclone Drive](https://rclone.org/drive/) i
[rclone crypt](https://rclone.org/crypt/). L'autorització OAuth és manual.
No reutilitzar tokens ni configuracions d'altres serveis.

Amb rclone disponible al VPS, instal·lar únicament l'script del repositori
`docker/backup-postgres.sh` a `/opt/aimetos-crm/backup-postgres.sh` (mode 700).
Dependències: sh, Docker CLI, rclone, flock, sha256sum. Crear fitxer mode 600
`/etc/aimetos-crm-backup.env`:

```sh
POSTGRES_SERVICE=aimetos-control-center_crm-postgres
BACKUP_DIR=/var/backups/aimetos-crm
BACKUP_REMOTE=crm-backups:
RCLONE_CONFIG=/root/.config/rclone/rclone.conf
KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=3
KEEP_LOCAL_DAYS=14
```

Confirmar el nom real amb `docker service ls` i adaptar només POSTGRES_SERVICE
si EasyPanel l'ha normalitzat. Provar primer manualment:

```sh
set -a
. /etc/aimetos-crm-backup.env
set +a
sh /opt/aimetos-crm/backup-postgres.sh
```

Nom `.dump` amb timestamp UTC, permisos privats, lock contra solapament,
verificació pg_restore i SHA256 després de tornar a llegir la còpia de Drive.
Retenció local de 14 dies i externa de 7 còpies daily, 4 weekly (diumenge UTC)
i 3 monthly (dia 1 UTC), totes configurables. Només elimina còpies pròpies
després de verificar Drive. Revisar quota mensualment.
Cron de root, diari a 03:15 en la zona del VPS (comprovar `timedatectl`):

```cron
15 3 * * * set -a; . /etc/aimetos-crm-backup.env; set +a; timeout 1h sh /opt/aimetos-crm/backup-postgres.sh >> /var/log/aimetos-crm-backup.log 2>&1
```

Comprovar cada dia un nou `backup.external_verified` i còpia recent. Configurar
rotació del log al VPS. Si falla o la còpia té més de 26 hores, resoldre abans
de seguir usant el CRM amb noves dades. L'automatització i OAuth encara no
s'han instal·lat ni provat en el VPS en aquesta sessió.

## 6. Restauració abans de publicar

Crear servei temporal **crm-restore-test**, Postgres 16 privat amb volum propi.
No apuntar mai a crm-postgres. Descarregar un backup extern i el manifest:

```sh
rclone copyto 'crm-backups:/daily/NOM.dump' /var/backups/aimetos-crm/NOM.dump
rclone copyto 'crm-backups:/daily/NOM.dump.sha256' /var/backups/aimetos-crm/NOM.dump.sha256
cd /var/backups/aimetos-crm
sha256sum -c NOM.dump.sha256
```

Trobar el contenidor temporal per l'etiqueta del seu servei (no el productiu),
copiar-hi el dump amb `docker cp`, i executar dins la seva Shell:

```sh
pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --exit-on-error /tmp/restore.dump
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'SELECT count(*) FROM "User"; SELECT count(*) FROM "PipelineStage";'
```

Comparar també recomptes Company, Contact, Opportunity, Task, Quote, Invoice
amb l'origen i provar login en una instància **privada** amb aquesta base.
Conservar evidència data/fitxer/recomptes. No obrir el domini si falla.
Els backups locals `.json.gz` són un altre format: es restauren amb
scripts/postgres-restore.ts sobre esquema migrat, mai amb pg_restore.

## 7. Validació, DNS i publicació

- Abans del DNS: health 200 i worker saludable, bootstrap sense demos,
  cap domini automàtic, backup extern i restore verificats.
- Provar per túnel SSH privat al servei: login requerit, crear contacte,
  oportunitat i tasca; reiniciar **només crm-app** i després redesplegar el
  mateix commit. Recuperar els tres registres. No tocar el volum de Postgres.
- Només després: Hostinger DNS, registre A `crm` → IPv4 del VPS. No canviar
  cap altre registre ni afegir AAAA sense IPv6 verificat. Associar
  `crm.aimetos.com` a crm-app, HTTPS automàtic i redirecció HTTP → HTTPS,
  upstream port 3000. No publicar Postgres ni worker.
- Verificar certificat vàlid, cookie Secure/HttpOnly/SameSite, login des de
  navegador i que una sessió anònima no pugui veure contactes o pipeline.
- Repetir flux comercial real i confirmar serveis anteriors intactes.

## 8. Desplegaments següents

Backup extern verificat abans de cada migració. Revisar SQL, executar
`migrate` explícitament una vegada i desplegar app/worker del mateix SHA.
Mai seed/reset, mai eliminar/recrear crm-postgres ni el volum. Rollback del
codi només si és compatible amb l'esquema; restaurar sempre primer en còpia
separada. No activar auto-deploy fins que el procés estigui comprovat.

## 9. Intervencio manual immediata i represa

1. Obrir nomes https://abrfjv.easypanel.host/ amb la sessio autenticada.
2. aimetos-control-center > crm-postgres > Credenciales: copiar la URL interna,
   mai exposar un port. No regenerar la contrasenya de PostgreSQL.
3. crm-app > Entorno: substituir AUTH_SECRET per un valor aleatori de 64
   caracters del gestor; DATABASE_URL i DIRECT_DATABASE_URL per la URL interna;
   ADMIN_PASSWORD per una contrasenya nova independent de minim 20 caracters.
   Guardar, sense Implementar. Conservar ADMIN_EMAIL=aimetos.agent@gmail.com.
4. crm-worker > Entorno: mateixos valors dels quatre camps i Guardar.
   No activar Create env file. No enviar secrets per xat.
5. Dominios de crm-app i crm-worker: eliminar nomes els dominis automatics
   aimetos-control-center-crm-app.abrfjv.easypanel.host i
   aimetos-control-center-crm-worker.abrfjv.easypanel.host. No eliminar serveis.
6. Retornar el control. Encara no desplegar ni importar dades reals.

Per al seguent pas caldra una sessio segura al terminal del VPS (Hostinger
Browser Terminal o SSH autoritzat) per cron/rclone. La clau SSH local actual
ha estat refusada. No cal canviar cap credencial del Control Center.
Google Drive requerira OAuth interactiu en rclone config; no enganxar tokens
al xat. DNS quan es demani: A, nom crm, valor 72.62.31.48, TTL 300 o el minim
permes, sense canviar altres registres.

Abans d'autoritzar us comercial, l'usuari ha de revocar la clau antiga d'n8n
exposada: Settings > n8n API > clau corresponent > revocar/eliminar. Si no es
pot identificar inequívocament, no revocar claus a cegues; revisar-ho manualment.
Actualitzar despres nomes les configuracions locals que l'usaven. No modificar
el projecte demo ni workflows/serveis. La revocacio encara no esta acreditada.

Estat: PARTIAL. Font/builders i plantilles d'entorn desats, PostgreSQL privat i
persistent arrencat; secrets, build Docker, migracions/bootstrap, OAuth Drive,
restore extern, persistencia VPS, DNS i certificat pendents. Les proves locals
del codi publicat ja passen: 59 unit, 33 integracio i 5 E2E, lint/typecheck/build.
