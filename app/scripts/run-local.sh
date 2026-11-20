#!/usr/bin/env bash
# Runs the whole stack without Docker or internet: a private PostgreSQL cluster,
# the in-process MQTT broker, the device simulator and `next dev`.
# Ctrl-C stops everything. State lives in app/.localdata (delete it to reset).
# Usage: scripts/run-local.sh        (from the app/ directory or anywhere)
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR=$PWD
DATA=$APP_DIR/.localdata
mkdir -p "$DATA"

# --- Prisma engines (bundled; see scripts/fetch-prisma-engines.sh) ---
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) arch=debian ;;
  Linux-aarch64) arch=linux-arm64 ;;
  *) arch="" ;; # macOS etc.: let Prisma use its normal download
esac
if [ -n "$arch" ]; then
  ssl=$(openssl version 2>/dev/null | awk '{print $2}')
  case "$ssl" in 1.1*) ssl=1.1.x ;; *) ssl=3.0.x ;; esac
  engines=$APP_DIR/vendor/prisma-engines/$arch-openssl-$ssl
  if [ ! -f "$engines/libquery_engine.so.node" ]; then
    echo "Missing Prisma engines in $engines." >&2
    echo "Run scripts/fetch-prisma-engines.sh on a machine with internet and include vendor/ in the upload." >&2
    exit 1
  fi
  export PRISMA_QUERY_ENGINE_LIBRARY=$engines/libquery_engine.so.node
  export PRISMA_SCHEMA_ENGINE_BINARY=$engines/schema-engine
  export PRISMA_HIDE_UPDATE_MESSAGE=1 CHECKPOINT_DISABLE=1 NEXT_TELEMETRY_DISABLED=1
fi

# --- PostgreSQL: own cluster on port 5433 so it never touches a system instance ---
PG_PORT=${PG_PORT:-5433}
if ! command -v pg_ctl >/dev/null; then
  pgbin=$(ls -d /usr/lib/postgresql/*/bin /usr/pgsql-*/bin /usr/local/pgsql/bin 2>/dev/null | sort -V | tail -1 || true)
  [ -n "$pgbin" ] || { echo "Can't find PostgreSQL binaries (pg_ctl). Add them to PATH." >&2; exit 1; }
  export PATH=$pgbin:$PATH
fi
if [ ! -f "$DATA/pg/PG_VERSION" ]; then
  echo "Initialising PostgreSQL cluster in $DATA/pg"
  # shortcut: trust auth on localhost only; fine for a sandbox, not for the Pi.
  initdb -D "$DATA/pg" -U homeauto --auth=trust >/dev/null
fi
pg_ctl -D "$DATA/pg" status >/dev/null 2>&1 ||
  pg_ctl -D "$DATA/pg" -l "$DATA/pg.log" -w start \
    -o "-p $PG_PORT -k $DATA -c listen_addresses=localhost"
psql -h localhost -p "$PG_PORT" -U homeauto -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='homeautomation'" | grep -q 1 ||
  createdb -h localhost -p "$PG_PORT" -U homeauto homeautomation

# --- App environment (real env vars win) ---
[ -f "$DATA/nextauth_secret" ] || openssl rand -base64 32 > "$DATA/nextauth_secret"
export DATABASE_URL=${DATABASE_URL:-postgresql://homeauto@localhost:$PG_PORT/homeautomation}
export MQTT_URL=${MQTT_URL:-mqtt://localhost:1883}
export NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
export NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-$(cat "$DATA/nextauth_secret")}
export ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
export ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin-local}
export SIMULATE_DEVICES=false # the simulator answers /set itself

[ -d node_modules ] || npm ci
npx prisma generate >/dev/null
npx prisma migrate deploy
npx prisma db seed

# --- Broker, simulator, app ---
pids=()
cleanup() {
  kill "${pids[@]}" 2>/dev/null || true
  pg_ctl -D "$DATA/pg" -m fast stop >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

node scripts/broker.mjs & pids+=($!)
sleep 1
[ "${SIMULATOR:-on}" = off ] || { node scripts/simulate.mjs & pids+=($!); }

echo
echo "Open $NEXTAUTH_URL and sign in as $ADMIN_EMAIL / $ADMIN_PASSWORD"
echo
npx next dev -p 3000
