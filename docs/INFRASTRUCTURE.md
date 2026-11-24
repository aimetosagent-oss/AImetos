# Infraestructura AImetos

Estat verificat el 24 de novembre de 2026. Desplegament CRM: **PARTIAL**, no
accessible encara a crm.aimetos.com. Cap cost recurrent addicional autoritzat.

## Projectes reals

| Projecte EasyPanel real | Responsabilitat funcional | Serveis | Dominis |
| --- | --- | --- | --- |
| demo | Infraestructura d'automatitzacions | n8n, postgres, redis, evolution-api, evolution-api-db, evolution-api-redis | Existents, fora d'abast |
| aimetos-control-center | AImetos Internal (nom funcional) | control-center existent; crm-app i crm-worker desplegats privats; crm-postgres persistent i migrat | control.aimetos.com; crm.aimetos.com pendent |
| aimetos-dashboard | AImetos Clients (nom funcional) | dashboard existent preservat | dashboard.aimetos.com |

No s'ha reanomenat cap projecte: els noms interns poden formar part del DNS,
identificadors Swarm i volums. El nom funcional no justifica aquest risc.
El límit gratuït de tres projectes ja no bloqueja l'estratègia acordada:
només s'afegeixen serveis independents al projecte intern existent.

## Accés administratiu i recursos

- Panell original: http://72.62.31.48:3000/ amb sessió disponible.
- Accés HTTPS existent localitzat al mateix panell:
  https://abrfjv.easypanel.host/. Certificat acceptat pel navegador, sense
  intersticial; sessió HTTPS autenticada i operativa.
- No s'han introduït secrets a HTTP ni canviat el domini del panell.
- SSH amb la clau local existent ha estat refusat. No s'han provat contrasenyes
  ni modificat authorized_keys. Cal accés segur abans de cron/rclone al host.
- Despres de desplegar: 4 cores, CPU 1%, RAM 2,6/15,6 GB, disc 28,2/192,7 GB.
  Durant build observat: CPU 53,7%, RAM 3,2/15,6 GB. Sense proves agressives.

## CRM

Mateixa arquitectura: Next.js/Auth.js/Prisma 6, worker separat i PostgreSQL 16.
Sense Redis addicional, serveis SaaS, SMTP real ni Stripe live.

- crm-app: desplegat privat, 58,7 MB observats; health HTTP 200 amb database ok.
  Ordre EasyPanel: dumb-init -- ./docker/entrypoint.sh app. Cap domini ni port public.
- crm-worker: desplegat mateix SHA, 81,2 MB observats; worker-health exit 0.
  Ordre: dumb-init -- ./docker/entrypoint.sh worker. Cap domini ni port public.
- Secrets independents desats i coherents als dos serveis. No consten a Git.
- crm-postgres: creat amb postgres:16-alpine, base aimetos_crm i usuari crm_app.
  Arrencada confirmada als logs, 69,4 MB RAM inicials. Port exposat 0 (privat).
  Muntatge persistent verificat a la consola del contenidor:
  /etc/easypanel/projects/aimetos-control-center/crm-postgres/data
  sobre /var/lib/postgresql/data. Quatre migracions aplicades; bootstrap sense demos:
  1 admin, 1 organitzacio i 12 etapes. Encara sense dades comercials carregades.
  Mai reutilitzar bases de demo o Control Center.
- Servei temporal de prova quan calgui: crm-restore-test, privat, amb base pròpia.
- Domini final de l'app: https://crm.aimetos.com, upstream intern 3000.
- Worker i Postgres: sense domini ni port publicat.

Variables no secretes i noms de secrets a docker/production.env.example.
ADMIN_EMAIL=aimetos.agent@gmail.com; ADMIN_PASSWORD independent de
CONTROL_CENTER_PASSWORD. No llegir ni reutilitzar la credencial del Control Center.
FISCAL_INVOICING_ENABLED=false: esborranys i PDFs disponibles, emissió bloquejada
al servidor fins a validar el compliment fiscal; no s'acredita VeriFactu.

## Persistència, codi i desplegaments

- Migracions amb prisma migrate deploy; cap reset ni seed demo a producció.
- Nova migració additiva de tres camps de recurrència, sense eliminar dades.
- Bootstrap productiu explícit: admin, organització, dades fiscals i 12 etapes.
  No reescriu una organització existent.
- Branca release codex/crm-production; SHA desplegat als dos serveis:
  b19ae55a86f64f4c5e4e9208b2430c6a2eefee0b. No utilitzar main per
  desplegar el CRM mentre inclogui canvis aliens o el codi validat no hi sigui.
- App i worker han d'executar el mateix SHA i Dockerfile d'arrel. No modificar
  la branca, font o auto-deploy del Control Center.
- Abans de cada migració: còpia externa verificada i revisió del SQL.
- Rollback: codi compatible amb l'esquema; restauració primer en base separada.
  No esborrar ni recrear crm-postgres o el seu volum durant un redesplegament.

## Transferència inicial controlada

Paquet local preparat (ignorat per Git):
backups/migration/approved-commercial-transfer.json.

- Ramon Figueras Alsius / La Cabina / interès mitjà.
- Jordi Olivé Currius / autònom sense empresa / interès baix.
- Víctor Gutiérrez Parron / Saló Guttié / pressupost enviat.
- Catàleg dels 20 productes aprovats.
- Exclosos: proves de Roger Arnau, demos, E2E, pressupostos, factures,
  pagaments, seqüències, usuaris, sessions, secrets, formularis i workflows.

Preparació feta des de la base local; **encara no importat**. No copiar tota la
base local a producció. Els IDs locals s'han de mapar als IDs de producció i
al nou administrador; conservar els identificadors GHL per deduplicar.

## Backup i restauració

Script docker/backup-postgres.sh, cron diari 03:15 (hora del VPS), directori
privat /var/backups/aimetos-crm, còpia a remote rclone crypt dedicat de Google Drive.
Sistema escollit davant Duplicati: aprofita els scripts existents i no afegeix
cap servei permanent ni interfície administrativa. Duplicati no instal·lat.
La configuracio efectiva del cron i de Drive encara esta pendent.
Retenció configurable: KEEP_DAILY=7, KEEP_WEEKLY=4, KEEP_MONTHLY=3,
KEEP_LOCAL_DAYS=14. Prefixos daily, weekly (diumenge UTC), monthly (dia 1 UTC).
Cada còpia es torna a llegir i es comprova per SHA256 abans de la retenció.
La retenció elimina només fitxers propis d'aquests prefixos, no altres dades.

Cal OAuth Drive i clau crypt guardada també fora del VPS. No operatiu fins a
descarregar, desxifrar i restaurar en crm-restore-test. El format productiu
.dump usa pg_restore; el format local .json.gz usa scripts/postgres-restore.ts.
No barrejar formats. Procediment complet a PRODUCTION_CRM_RUNBOOK.md.

## Rutina mínima

- Diari: health app, heartbeat worker recent, últim backup external_verified
  de menys de 26 hores, errors de jobs i espai de disc.
- Setmanal: revisar errors/reintents, logs i quota Drive. Rotació de logs al VPS.
- Mensual: restauració externa de prova, validesa de claus OAuth i recursos.
- Després de desplegar: login, sessió anònima rebutjada, persistència de tasques,
  app/worker mateix SHA i Control Center encara operatiu.

## Bloquejos i seguretat

Pendents: acces segur al host (Hostinger login manual), DNS, OAuth/crypt/cron,
health checks automatics, restore extern i E2E productiu
en organització aïllada. No declarar PASS ni publicar dades reals abans.

La clau n8n exposada en commits anteriors no consta com a revocada. El fitxer
local està exclòs, però això no elimina l'historial. S'ha informat l'usuari;
no s'ha tocat demo ni provat la clau contra l'API.
L'auditoria de dependències manté avisos de la cadena CLI de Prisma 6 i
baseline-browser-mapping; veure HANDOFF_CRM.md. Cap actualització major feta.

GHL, Meta, WhatsApp, calendaris avançats, SMTP, Stripe live, SaaS i funcionalitats
de clients continuen ajornats. La facturació fiscal no es declara validada.
