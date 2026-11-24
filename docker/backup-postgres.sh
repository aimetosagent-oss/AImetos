#!/bin/sh
set -eu
umask 077
: "${POSTGRES_SERVICE:?Set the dedicated CRM Docker Swarm service name}"
: "${BACKUP_REMOTE:?Set an encrypted rclone remote outside this VPS}"
BACKUP_DIR=${BACKUP_DIR:-/var/backups/aimetos-crm}
KEEP_DAILY=${KEEP_DAILY:-7}
KEEP_WEEKLY=${KEEP_WEEKLY:-4}
KEEP_MONTHLY=${KEEP_MONTHLY:-3}
KEEP_LOCAL_DAYS=${KEEP_LOCAL_DAYS:-14}
for count in "$KEEP_DAILY" "$KEEP_WEEKLY" "$KEEP_MONTHLY" "$KEEP_LOCAL_DAYS"; do
  case "$count" in ''|*[!0-9]*|0) echo 'Retention values must be positive integers' >&2; exit 1;; esac
done
mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || exit 1
container=$(docker ps --filter "label=com.docker.swarm.service.name=$POSTGRES_SERVICE" --format '{{.ID}}')
[ -n "$container" ] && [ "$(printf '%s\n' "$container" | wc -l)" -eq 1 ] || { echo 'Expected exactly one CRM PostgreSQL container' >&2; exit 1; }
name="aimetos-crm-$(date -u +%Y%m%dT%H%M%SZ).dump"
file="$BACKUP_DIR/$name"
trap 'rm -f "$file.partial"' EXIT
docker exec "$container" sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file.partial"
test -s "$file.partial"
docker exec -i "$container" pg_restore --list < "$file.partial" > /dev/null
mv "$file.partial" "$file"
local_hash=$(sha256sum "$file" | cut -d ' ' -f 1)
printf '%s %s\n' "$local_hash" "$name" > "$file.sha256"

store_bucket() {
  bucket=$1
  keep=$2
  remote="$BACKUP_REMOTE/$bucket"
  rclone copyto "$file" "$remote/$name" --retries 3
  remote_hash=$(rclone cat "$remote/$name" | sha256sum | cut -d ' ' -f 1)
  [ "$local_hash" = "$remote_hash" ] || { echo 'External backup checksum mismatch' >&2; exit 1; }
  rclone copyto "$file.sha256" "$remote/$name.sha256"
  listing=$(rclone lsf "$remote" --files-only --include 'aimetos-crm-*.dump')
  printf '%s\n' "$listing" | sort -r | tail -n "+$((keep + 1))" | while IFS= read -r old; do
    case "$old" in ''|*/*|*[!A-Za-z0-9.-]*) continue;; esac
    case "$old" in aimetos-crm-*.dump)
      rclone deletefile "$remote/$old"
      rclone deletefile "$remote/$old.sha256"
    esac
  done
}

store_bucket daily "$KEEP_DAILY"
if [ "$(date -u +%u)" = 7 ]; then store_bucket weekly "$KEEP_WEEKLY"; fi
if [ "$(date -u +%d)" = 01 ]; then store_bucket monthly "$KEEP_MONTHLY"; fi
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'aimetos-crm-*.dump*' -mtime "+$KEEP_LOCAL_DAYS" -delete
echo "backup.external_verified $name"
