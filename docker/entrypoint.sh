#!/bin/sh
set -eu

role="${1:-app}"
if [ "$#" -gt 0 ]; then
  shift
fi

node scripts/production-preflight.mjs

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
    exec node node_modules/tsx/dist/cli.mjs src/worker/main.ts "$@"
    ;;
  migrate)
    run_migrations
    ;;
  seed)
    if [ "${PRODUCTION_DEPLOYMENT:-false}" = "true" ]; then
      echo 'Use bootstrap, not seed, in production' >&2
      exit 1
    fi
    run_seed
    ;;
  bootstrap)
    exec node node_modules/tsx/dist/cli.mjs scripts/bootstrap-production.ts
    ;;
  *)
    exec "$role" "$@"
    ;;
esac
