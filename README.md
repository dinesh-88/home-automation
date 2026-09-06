# Home Automation

Zigbee2MQTT → MQTT → Next.js/PostgreSQL home automation stack: real-time dashboard,
light/heater controls, a small rule engine ("if temp < 20°C, turn heater on"), and
role-based auth (admin / user / guest). Runs entirely via Docker Compose.

## Architecture

```
Zigbee devices --(zigbee radio)--> zigbee2mqtt --(MQTT)--> mosquitto
                                                                |
                                                     subscribes on app boot
                                                                v
                                            Next.js app (instrumentation.ts)
                                              - persists state -> PostgreSQL
                                              - evaluates rules -> publishes commands
                                              - streams updates -> dashboard (SSE)
```

- **mosquitto** — MQTT broker.
- **zigbee2mqtt** — bridges your Zigbee USB adapter to MQTT topics under `zigbee2mqtt/#`.
- **postgres** — stores devices, device history, rules and users.
- **app** — Next.js app (App Router). On boot it connects to MQTT (`src/instrumentation.ts`
  → `src/lib/mqtt.ts`), upserts device rows on every state message, evaluates rules
  (`src/lib/ruleEngine.ts`), and pushes live updates to the dashboard over Server-Sent
  Events (`/api/events`).

## Prerequisites (on the Raspberry Pi)

- Raspberry Pi OS (64-bit recommended) with Docker + the Docker Compose plugin installed.
- A Zigbee USB adapter (e.g. Sonoff Zigbee 3.0 dongle, ConBee II) plugged in.
- Your Zigbee heaters/lights ready to pair.

## First-time setup

1. **Copy the env file and edit it:**

   ```bash
   cp .env.example .env
   ```

   At minimum, change on the Pi:
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — set to `http://<raspberry-pi-ip>:3000`
   - `POSTGRES_PASSWORD` / `DATABASE_URL` — pick a real password (keep both in sync)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your admin login, created automatically on first boot
   - `ZIGBEE_ADAPTER` — the device path of your Zigbee USB adapter

2. **Find your Zigbee adapter's device path:**

   ```bash
   ls /dev/serial/by-id/   # preferred: stable across reboots/USB port changes
   # or
   ls /dev/ttyACM* /dev/ttyUSB*
   ```

   Set `ZIGBEE_ADAPTER` in `.env` to whichever path you find (a `/dev/serial/by-id/...`
   path is best since it won't change if you plug into a different USB port). Also update
   `serial.port` in `zigbee2mqtt/data/configuration.yaml` to the same path.

3. **Start everything with one command:**

   ```bash
   docker compose up -d --build
   ```

   This builds the app image, starts Postgres + Mosquitto, then the app, which
   automatically runs database migrations and seeds your admin account before
   starting the server — no manual steps required. zigbee2mqtt starts in parallel.

4. **Open the app** at `http://<raspberry-pi-ip>:3000` and log in with the
   `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`.

5. **Pair your Zigbee devices.** Open the Zigbee2MQTT frontend at
   `http://<raspberry-pi-ip>:8080`, put your heaters/lights into pairing mode, and they'll
   join the network (permit_join is on by default — turn it off in
   `zigbee2mqtt/data/configuration.yaml` once you're done pairing, for security).
   Devices appear automatically on the dashboard as soon as they send their first state
   update — no manual registration needed. Their type (light/heater/sensor) is inferred
   from the fields in their first MQTT payload.

## Using it

- **Dashboard** (`/`) — shows every known device with a live status dot and controls.
  Lights get an on/off toggle; heaters get on/off plus a setpoint slider; sensors show
  their raw readings. Updates arrive in real time over SSE — no polling, no refresh needed.
- **Rules** (`/rules`, admin only) — create rules like "if `local_temperature` on
  `bedroom_sensor` is `<` `20`, set `bedroom_heater` to `{"state":"ON"}`, else
  `{"state":"OFF"}`". The engine only publishes a command when the target device isn't
  already in that state, so it won't spam MQTT.

## Roles

| Role  | View dashboard | Toggle lights / set heater temp | Manage rules |
|-------|:--:|:--:|:--:|
| ADMIN | ✅ | ✅ | ✅ |
| USER  | ✅ | ✅ | ❌ |
| GUEST | ✅ | ❌ | ❌ |

Only the admin account is seeded automatically. To add more users, run this against the
`app` container (or `postgres` directly) — there's no user-management UI by design, since
this is meant to run on a trusted home LAN for a handful of household accounts:

```bash
docker compose exec app node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
(async () => {
  await prisma.user.create({
    data: {
      email: 'someone@example.com',
      passwordHash: await bcrypt.hash('choose-a-password', 10),
      role: 'USER', // or 'GUEST'
    },
  });
  await prisma.\$disconnect();
})();
"
```

## Operational notes

- **Data persistence**: Postgres data lives in the `pgdata` Docker volume; Zigbee2MQTT's
  paired-device database and network key live in `zigbee2mqtt/data/` on the host — back
  both up if you care about not re-pairing devices after a rebuild.
- **Postgres port**: `docker-compose.yml` publishes Postgres on `127.0.0.1:5432` (loopback
  only) so you can inspect the DB locally with `psql` or a GUI client if needed.
- **Restarting after a code change**: `docker compose up -d --build app` rebuilds and
  restarts just the app; migrations run automatically on every boot via
  `docker-entrypoint.sh` (`prisma migrate deploy`, which only applies new/pending
  migrations, so it's safe to run every time).
- **Changing the schema**: if you modify `app/prisma/schema.prisma`, generate a migration
  locally before rebuilding the image (`prisma migrate deploy` only applies migrations
  that already exist in `app/prisma/migrations/`, it doesn't generate them):

  ```bash
  cd app
  DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/<db>" npx prisma migrate dev --name <change-name>
  ```

  (requires the Postgres port to be reachable from your host, per the note above).
- **Compression is disabled** (`compress: false` in `app/next.config.mjs`) because Next's
  built-in gzip buffers streamed responses, which breaks the `/api/events` SSE stream. Put
  a reverse proxy in front if you want compression back for a WAN-facing deployment.
- **MQTT security**: `mosquitto.conf` allows anonymous connections, since Mosquitto is only
  reachable on the Docker Compose network by default. If you publish port 1883 beyond your
  LAN, switch to `password_file` auth in `mosquitto/config/mosquitto.conf`.

## Local development (without Docker)

```bash
cd app
npm install
npx prisma migrate dev   # needs a local/reachable Postgres; set DATABASE_URL
npm run dev
```

You'll still need Mosquitto (and optionally Zigbee2MQTT) reachable at whatever `MQTT_URL`
you set — `docker compose up -d mosquitto` is enough to develop the UI against fake MQTT
messages published with `mosquitto_pub`.
# home-automation
