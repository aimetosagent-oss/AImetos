# CRM: operacions manuals revisables

Estat: preparat, NO executat al VPS. Autoritzacio vigent del 24/11/2026:
Codex no accedeix al compte Hostinger ni al terminal root. L'usuari revisa i
executa cada bloc. Cap ordre d'aquesta guia canvia serveis aliens, xarxes,
volums existents, firewall, paquets globals, /etc/crontab o la configuracio
global d'EasyPanel. No hi ha reinicis del VPS ni de Docker.

Executar els blocs de shell al mateix terminal del VPS, en ordre. Davant
qualsevol error, ATURAR-SE. En una nova sessio cal repetir el bloc 1.
No enviar fitxers .env, tokens, configuracio rclone ni dumps al xat.

## 1. Identificacio i eines: nomes lectura

Aquest bloc consulta exclusivament els tres serveis CRM. No llegeix variables
secretes. Rebutja serveis no inclosos i exigeix un sol contenidor actiu per
servei: no executar durant un desplegament amb dues repliques transitories.

```sh
set -eu
umask 077
crm_cid() {
  case "$1" in
    aimetos-control-center_crm-app|aimetos-control-center_crm-worker|aimetos-control-center_crm-postgres) ;;
    *) echo 'Servei fora de l ambit CRM' >&2; return 1 ;;
  esac
  ids=$(docker ps --filter "label=com.docker.swarm.service.name=$1" --format '{{.ID}}') || return 1
  if [ -z "$ids" ] || [ "$(printf '%s\n' "$ids" | wc -l)" -ne 1 ]; then
    echo 'Cal exactament un contenidor CRM actiu per servei' >&2
    return 1
  fi
  printf '%s\n' "$ids"
}
CRM_DB_CID=$(crm_cid aimetos-control-center_crm-postgres)
CRM_APP_CID=$(crm_cid aimetos-control-center_crm-app)
CRM_WORKER_CID=$(crm_cid aimetos-control-center_crm-worker)
docker stats --no-stream "$CRM_DB_CID" "$CRM_APP_CID" "$CRM_WORKER_CID"
docker exec "$CRM_DB_CID" sh -ec 'test "$POSTGRES_DB" = aimetos_crm; test "$POSTGRES_USER" = crm_app; pg_dump --version; pg_restore --version'
uname -m
for tool in docker rclone flock sha256sum timeout diff install mktemp; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf '%s: disponible\n' "$tool"
  else
    printf '%s: FALTA\n' "$tool"
  fi
done
```

Retornar nomes la sortida d'aquest bloc, sense afegir secrets. Si falta rclone
o una altra eina, no executar els blocs de backup: no hi ha cap apt install,
actualitzacio del sistema ni instal·lador global autoritzat. Es preparara,
si cal, un binari verificat dins de /opt/aimetos-crm/bin, despres de coneixer
l'arquitectura (`uname -m`) i revisar-lo amb l'usuari.

## 2. Health: preferentment consoles natives d'EasyPanel

Cap canvi ni reinici. Alternativa sense terminal root:
aimetos-control-center > crm-app > Console > Sh:

```sh
node -e '(async()=>{for(const p of ["/api/health","/contacts","/pipeline","/api/exports/contacts"]){const r=await fetch("http://127.0.0.1:3000"+p,{redirect:"manual"});console.log(p,r.status,r.headers.get("location")||"");if(p==="/api/health")console.log(await r.text())}})()'
```

Esperat: health 200 amb database ok; altres rutes 307 /login sense sessio.
crm-worker > Console > Sh:

```sh
node scripts/worker-health.mjs && echo worker-health-ok
```

Aquestes ordres ja van passar el 24/11. Nomes repetir despres d'un canvi o
reinici que calgui validar. No mostren cookies ni credencials.

## 3. Directori privat i script existent

CANVI REVISABLE: crea nomes directoris /opt/aimetos-crm amb permisos 700 i copia
l'script ja desplegat des de crm-app. No escriu dins dels contenidors.
No toca /etc, cap volum Docker ni altres aplicacions. No repetir si el fitxer
ja existeix: revisar-ne primer l'origen i el hash, sense sobreescriure'l.

```sh
test ! -L /opt/aimetos-crm
for dir in bin config backups logs restore-check; do
  test ! -L "/opt/aimetos-crm/$dir"
done
install -d -m 700 /opt/aimetos-crm /opt/aimetos-crm/bin /opt/aimetos-crm/config /opt/aimetos-crm/backups /opt/aimetos-crm/logs /opt/aimetos-crm/restore-check
test ! -e /opt/aimetos-crm/bin/backup-postgres.sh
docker cp "$CRM_APP_CID:/app/docker/backup-postgres.sh" /opt/aimetos-crm/bin/backup-postgres.sh
printf '%s  %s\n' 'ffe6345e946b6f765e5a25cb9aea35c9a31a9754bfe3f71bd9455f7d50723084' '/opt/aimetos-crm/bin/backup-postgres.sh' | sha256sum -c -
chmod 700 /opt/aimetos-crm/bin/backup-postgres.sh
df -h /opt/aimetos-crm
```

El hash correspon a docker/backup-postgres.sh del SHA desplegat b19ae55. Si
no coincideix, aturar-se; no baixar un script mutable ni executar-lo igualment.

## 4. Drive xifrat: configuracio manual privada

Requereix rclone ja disponible. CANVI REVISABLE: crea exclusivament
/opt/aimetos-crm/config/rclone.conf i una carpeta nova privada del compte Drive
autoritzat per l'usuari. No reutilitza ni altera cap configuracio rclone global.

```sh
command -v rclone
test ! -e /opt/aimetos-crm/config/rclone.conf
rclone --config /opt/aimetos-crm/config/rclone.conf config
```

Al dialeg de rclone, l'usuari configura:

| Camp | Valor |
| --- | --- |
| Primer remote | drive-crm |
| Tipus | drive (Google Drive) |
| Scope | drive.file, nomes fitxers creats/oberts per aquesta aplicacio |
| Compte | El Drive propi autoritzat per l'usuari, sense shared drive |
| Segon remote | crm-backups |
| Tipus | crypt |
| Remote a xifrar | drive-crm:AImetos-CRM-Backups |
| Noms de fitxer | standard |
| Directoris xifrats | true |
| Password i salt | Nous, diferents; conservar-los al gestor fora del VPS |

No seleccionar full Drive per comoditat. En entorn headless, seguir el dialeg
oficial amb `rclone authorize drive` en un ordinador propi; el token s'introdueix
nomes al dialeg privat del VPS, mai al xat. No copiar aquest token al repositori.
No operar contra drive-crm directament per pujar dumps: saltaria el xifrat.

```sh
chmod 600 /opt/aimetos-crm/config/rclone.conf
rclone --config /opt/aimetos-crm/config/rclone.conf listremotes
rclone --config /opt/aimetos-crm/config/rclone.conf lsd crm-backups:
```

Comprovar al dialeg que crm-backups sigui crypt abans de continuar. Confirmar
que la clau i el salt son recuperables fora del VPS. No compartir la sortida de
config show/config dump ni el fitxer de configuracio.

Fonts: [Drive](https://rclone.org/drive/), [crypt](https://rclone.org/crypt/).

## 5. Primera copia manual verificada

CANVI REVISABLE: llegeix nomes aimetos_crm, escriu dumps comprimits i manifestos
a /opt/aimetos-crm/backups, i puja nomes al remote crypt dedicat. No bloqueja
escriptures comercials, no reinicia Postgres i no copia PGDATA.

ATENCIO: l'script existent aplica retencio 7 daily / 4 weekly / 3 monthly i
14 dies locals. Pot eliminar copies antigues PROPIES d'aquesta carpeta i
remote despres de verificar la nova. Revisar aquest comportament abans de
la primera execucio. No usar mai carpetes/remote compartits amb altres backups.

```sh
CRM_DB_CID=$(crm_cid aimetos-control-center_crm-postgres)
docker exec "$CRM_DB_CID" sh -ec 'test "$POSTGRES_DB" = aimetos_crm; test "$POSTGRES_USER" = crm_app'
export POSTGRES_SERVICE=aimetos-control-center_crm-postgres
export BACKUP_DIR=/opt/aimetos-crm/backups
export BACKUP_REMOTE=crm-backups:
export RCLONE_CONFIG=/opt/aimetos-crm/config/rclone.conf
export KEEP_DAILY=7 KEEP_WEEKLY=4 KEEP_MONTHLY=3 KEEP_LOCAL_DAYS=14
CRM_BACKUP_LOG="/opt/aimetos-crm/logs/backup-$(date -u +%Y%m%dT%H%M%SZ).log"
timeout 1h sh /opt/aimetos-crm/bin/backup-postgres.sh > "$CRM_BACKUP_LOG" 2>&1
tail -n 5 "$CRM_BACKUP_LOG"
```

Esperat: `backup.external_verified aimetos-crm-...dump`. L'script comprova
pg_restore --list i rellegeix/desxifra Drive per comparar SHA256. Aixo encara
NO prova que totes les dades es puguin restaurar: cal el bloc seguent.
No enviar el dump al xat. Un error implica aturar-se i revisar el log privat.

## 6. Recuperacio externa en una base nova del CRM

CANVI REVISABLE: baixa i desxifra la copia a un directori CRM nou; crea una
base `aimetos_crm_restore_...` dins de crm-postgres, sense afegir serveis,
contenidors, xarxes o volums. No restaura mai sobre aimetos_crm i no fa DROP,
TRUNCATE, --clean ni sobreescriptures. Es conserva la base de prova per revisar.
Fer aquesta primera prova abans d'importar dades o obrir escriptures publiques.

```sh
CRM_DB_CID=$(crm_cid aimetos-control-center_crm-postgres)
export RCLONE_CONFIG=/opt/aimetos-crm/config/rclone.conf
CRM_CHECK_DIR=$(mktemp -d /opt/aimetos-crm/restore-check/check-XXXXXXXX)
rclone lsf crm-backups:/daily --files-only --include 'aimetos-crm-*.dump' > "$CRM_CHECK_DIR/remote-list.txt"
CRM_BACKUP_NAME=$(LC_ALL=C sort "$CRM_CHECK_DIR/remote-list.txt" | tail -n 1)
printf '%s\n' "$CRM_BACKUP_NAME" | grep -Eq '^aimetos-crm-[0-9]{8}T[0-9]{6}Z[.]dump$'
rclone copyto "crm-backups:/daily/$CRM_BACKUP_NAME" "$CRM_CHECK_DIR/$CRM_BACKUP_NAME"
rclone copyto "crm-backups:/daily/$CRM_BACKUP_NAME.sha256" "$CRM_CHECK_DIR/$CRM_BACKUP_NAME.sha256"
cd "$CRM_CHECK_DIR"
read -r expected_hash expected_name < "$CRM_BACKUP_NAME.sha256"
test "$expected_name" = "$CRM_BACKUP_NAME"
printf '%s  %s\n' "$expected_hash" "$CRM_BACKUP_NAME" | sha256sum -c -
docker exec -i "$CRM_DB_CID" pg_restore --list < "$CRM_CHECK_DIR/$CRM_BACKUP_NAME" > "$CRM_CHECK_DIR/archive-list.txt"
CRM_RESTORE_DB="aimetos_crm_restore_$(date -u +%Y%m%dT%H%M%S)"
docker exec "$CRM_DB_CID" sh -ec 'test "$POSTGRES_DB" = aimetos_crm; test "$POSTGRES_USER" = crm_app; createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$1"' sh "$CRM_RESTORE_DB"
docker exec -i "$CRM_DB_CID" sh -ec 'exec pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-acl --exit-on-error --single-transaction' sh "$CRM_RESTORE_DB" < "$CRM_CHECK_DIR/$CRM_BACKUP_NAME"
printf 'Base de prova: %s\nDirectori de prova: %s\n' "$CRM_RESTORE_DB" "$CRM_CHECK_DIR"
```

createdb falla si el nom ja existeix; amb set -e la restauracio no continua.
No eliminar una base per poder repetir el bloc. Una nova execucio usa un altre
nom. No executar aquest bloc durant importacions o altres escriptures.

Comparar recomptes (nomes lectura de la base original i la de prova):

```sh
CRM_COUNTS_SQL="SELECT 'Company',count(*) FROM \"Company\" UNION ALL SELECT 'Contact',count(*) FROM \"Contact\" UNION ALL SELECT 'Opportunity',count(*) FROM \"Opportunity\" UNION ALL SELECT 'Task',count(*) FROM \"Task\" UNION ALL SELECT 'Product',count(*) FROM \"Product\" UNION ALL SELECT 'Quote',count(*) FROM \"Quote\" UNION ALL SELECT 'Invoice',count(*) FROM \"Invoice\" UNION ALL SELECT 'PipelineStage',count(*) FROM \"PipelineStage\" UNION ALL SELECT 'User',count(*) FROM \"User\" ORDER BY 1"
docker exec "$CRM_DB_CID" sh -ec 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d aimetos_crm -At -c "$1"' sh "$CRM_COUNTS_SQL" > "$CRM_CHECK_DIR/source-counts.txt"
docker exec "$CRM_DB_CID" sh -ec 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -At -c "$2"' sh "$CRM_RESTORE_DB" "$CRM_COUNTS_SQL" > "$CRM_CHECK_DIR/restored-counts.txt"
diff -u "$CRM_CHECK_DIR/source-counts.txt" "$CRM_CHECK_DIR/restored-counts.txt"
cat "$CRM_CHECK_DIR/restored-counts.txt"
```

Esperat ara: User 1, PipelineStage 12 i la resta 0. diff sense diferencies.
Guardar data, nom del dump, resultat SHA256, exit code de pg_restore i recomptes.
El login i el flux comercial sobre la copia aillada encara requereixen la seva
validacio; no declarar E2E productiu superat amb nomes aquests recomptes.

## 7. Programacio diaria: PENDENT, no instal·lar cron global

No executar crontab -e/-r, no sobreescriure crontabs, no escriure a /etc/cron.d,
no modificar systemd ni instal·lar un servei de backups. Les comandes anteriors
son manuals i NO resolen la programacio automatica persistent.

Prioritat: comprovar a crm-postgres > Copias de seguridad si el pla EXISTENT
permet programacio sense cost i sense canviar proveidors globals. No activar
una prova de pagament, ampliar llicencia ni editar Storage Providers globals.
La [documentacio oficial](https://easypanel.io/docs/backups/database) exigeix
una llicencia que inclogui els backups programats; no es dona per disponible
al pla Free. Els [Scripts d'App](https://easypanel.io/docs/services/app#scripts)
son llançadors manuals, no acrediten cap planificador diari.

Si aquesta capacitat no existeix al pla actual, cal acordar una solucio que
respecti la restriccio abans de continuar. No s'afegira silenciosament un cron
global ni un servei nou. Fins llavors: PARTIAL, no autoritzat l'us comercial.

## 8. DNS i EasyPanel: accions manuals concretes

Preparar el registre; publicar el domini de l'app nomes despres de superar
recuperacio externa, programacio diaria i els controls de seguretat pendents.

| Camp DNS Hostinger | Valor |
| --- | --- |
| Zona | aimetos.com |
| Tipus | A |
| Nom | crm |
| IPv4 / apunta a | 72.62.31.48 |
| TTL | 300 segons; si no s'admet, el minim permes |

Si ja existeix un A, AAAA o CNAME per a crm, aturar-se i revisar-lo; no
sobreescriure ni eliminar registres a cegues. No crear AAAA, wildcard, MX,
TXT de correu ni registres per a worker/Postgres. No tocar cap altre domini.

Quan els requisits previs estiguin superats, a EasyPanel:
aimetos-control-center > crm-app > Dominios > Agregar dominio:

| Camp | Valor |
| --- | --- |
| Host | crm.aimetos.com |
| Ruta publica | / |
| HTTPS | Activat, certificat automatic valid |
| Destinacio protocol | HTTP |
| Destinacio port | 3000 |
| Destinacio ruta | / |
| Domini principal | crm.aimetos.com |

No cal proxy nou ni port public 3000. HTTPS el resol el proxy existent. Verificar
la redireccio HTTP -> HTTPS; no canviar configuracio global de Traefik ni obrir
ports/firewall. Si no es pot fer una redireccio especifica del domini amb les
opcions actuals, aturar-se i documentar-ho, no aplicar una regla global.

Comprovacions locals sense secrets (PowerShell de l'ordinador de l'usuari):

```powershell
Resolve-DnsName crm.aimetos.com -Type A
curl.exe --head http://crm.aimetos.com
curl.exe --head https://crm.aimetos.com/login
```

No usar -k ni acceptar avisos de certificat. Despres provar login al navegador,
cookies Secure/HttpOnly/SameSite i rutes privades en finestra anonima.

## 9. Despres dels backups: transferencia i prova comercial

No importar encara: el paquet aprovat 3 contactes/oportunitats i 20 productes
esta local i ignorat per Git. El consumidor idempotent productiu encara no
esta implementat/verificat; no usar un restore complet de la base local ni
l'importador GHL generic per saltar aquest control. No publicar dades personals.

Abans de declarar PASS: transferencia revisada sense duplicats, E2E en tenant
de prova separat, reinici nomes de crm-app des d'EasyPanel i recuperacio dels
registres, comprovacio del worker, backups diaris i restauracio externa.
No executar el seed demo per crear el tenant de prova.

La clau antiga n8n continua pendent de revocacio acreditada per l'usuari,
sense acces de Codex a demo. Cap cobrament, SMTP real ni factura fiscal real.
Per actualitzar: backup verificat, revisio SQL, migrate deploy nomes si cal i
app/worker al mateix SHA. Per rollback: codi compatible, mai reset ni restaurar
directament sobre aimetos_crm sense un procediment separat i autoritzat.
