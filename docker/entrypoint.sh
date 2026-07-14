#!/bin/sh
set -eu

role="${1:-app}"
if [ "$#" -gt 0 ]; then
  shift
fi

run_migrations() {
  echo '{"level":"info","component":"entrypoint","message":"Applying database migrations"}'
  npm run db:migrate
}

run_seed() {
  echo '{"level":"info","component":"entrypoint","message":"Seeding initial data"}'
  npm run db:seed
}

case "$role" in
  app)
    if [ "${MIGRATE_ON_START:-false}" = "true" ]; then
      run_migrations
    fi
    if [ "${SEED_ON_START:-false}" = "true" ]; then
      run_seed
    fi
    exec node server.js "$@"
    ;;
  worker)
    rm -f /tmp/aimetos-worker-ready
    touch /tmp/aimetos-worker-ready
    exec npm run worker -- "$@"
    ;;
  migrate)
    run_migrations
    ;;
  seed)
    run_seed
    ;;
  *)
    exec "$role" "$@"
    ;;
esac
