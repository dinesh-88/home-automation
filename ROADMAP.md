# Roadmap

Planned work for this home automation stack, in rough priority order. I'll build it with Claude Code as my AI coding assistant, so estimates are in hours of hands-on work with Claude Code: prompting, reviewing the generated code, testing on the Raspberry Pi with real Zigbee devices, and fixing what the AI gets wrong. Each task is broken into subtasks; the subtask hours add up to the task estimate.

**Total estimate: ~107 hours**

| Phase | Estimate |
| --- | --- |
| [1. Reliability and bug fixes](#phase-1-reliability-and-bug-fixes-11-h) | 11 h |
| [2. Security hardening](#phase-2-security-hardening-12-h) | 12 h |
| [3. Tests and CI](#phase-3-tests-and-ci-12-h) | 12 h |
| [4. Automation features](#phase-4-automation-features-25-h) | 25 h |
| [5. Dashboard and user experience](#phase-5-dashboard-and-user-experience-21-h) | 21 h |
| [6. Notifications and energy](#phase-6-notifications-and-energy-7-h) | 7 h |
| [7. Operations and documentation](#phase-7-operations-and-documentation-10-h) | 10 h |
| [8. Heating control](#phase-8-heating-control-9-h) | 9 h |

---

## Phase 1: Reliability and bug fixes (~11 h)

### 1.1 Don't report success when a command can't be sent (1.5 h)

- [ ] `publishCommand` returns whether the message was published instead of only logging (0.5 h)
- [ ] `POST /api/devices/[id]/set` returns `503` when MQTT is disconnected; the dashboard shows the error on the device card (0.5 h)
- [ ] Tests for the connected and disconnected cases (0.5 h)

### 1.2 Validate device commands (2 h)

- [ ] Allow-list of command keys and value ranges per device type (light: state, brightness, color_temp; heater: state, setpoint) (1 h)
- [ ] Reject unknown keys and out-of-range values with `400` in the API and in rule actions (0.5 h)
- [ ] Tests (0.5 h)

### 1.3 Stop rules from flapping (3 h)

- [ ] Add hysteresis to rules (e.g. heater on below 20 °C, off only above 20.5 °C) (1 h)
- [ ] Minimum on/off time per rule so a heater isn't switched every few seconds (1 h)
- [ ] Migration, rules form fields and tests with a simulated temperature sequence (1 h)

### 1.4 Device history retention (3 h)

- [ ] Store history only when values change, not on every MQTT message (1 h)
- [ ] Nightly job: keep raw data for 7 days, then hourly averages, then delete after a configurable period (1.5 h)
- [ ] Measure database size before and after on the Pi (0.5 h)

### 1.5 Health checks and failure handling (1.5 h)

- [ ] `/api/health` reporting database and MQTT status (0.5 h)
- [ ] Docker Compose health checks so services restart in the right order (0.5 h)
- [ ] Show a "broker offline" banner on the dashboard (0.5 h)

---

## Phase 2: Security hardening (~12 h)

### 2.1 Authenticated MQTT (3 h)

- [ ] Mosquitto password file and per-client ACLs (app, zigbee2mqtt) instead of `allow_anonymous true` (1.5 h)
- [ ] Pass MQTT credentials to the app and zigbee2mqtt through `.env`; update `.env.example` (0.5 h)
- [ ] Update the README setup steps and test a clean install (1 h)

### 2.2 Controlled device pairing (3 h)

- [ ] Turn `permit_join` off by default (0.5 h)
- [ ] Admin-only "Pair a device" button that opens pairing for a set time through the zigbee2mqtt bridge API (1.5 h)
- [ ] Show newly joined devices and let the admin name them (1 h)

### 2.3 Login protection (2 h)

- [ ] Rate-limit failed logins per IP and per account (1 h)
- [ ] Configurable session lifetime and sign-out of all sessions after a password change (1 h)

### 2.4 Dependencies and headers (2 h)

- [ ] Upgrade next-auth from the 5.0 beta to a stable release and fix breaking changes (1 h)
- [ ] Security headers (CSP, frame options) and Dependabot for npm and Docker images (1 h)

### 2.5 Audit log of user actions (2 h)

- [ ] Record who sent which command, changed a rule or logged in, with a timestamp (1 h)
- [ ] Admin page to browse the log, plus a retention period (1 h)

---

## Phase 3: Tests and CI (~12 h)

### 3.1 Rule engine unit tests (3 h)

- [ ] Set up Vitest with a Prisma test database (1 h)
- [ ] Tests for every operator, else-actions, the "already applied" check and disabled rules (2 h)

### 3.2 MQTT handling tests (3 h)

- [ ] Fake MQTT client to feed messages into `handleMessage` (1 h)
- [ ] Tests for state merging, the per-device queue (no lost updates), availability and bridge topics (2 h)

### 3.3 API route tests (2.5 h)

- [ ] Tests for admin, user and guest permissions on devices, rules and events (1.5 h)
- [ ] Tests for invalid bodies and unknown devices (1 h)

### 3.4 Linting and GitHub Actions (2.5 h)

- [ ] ESLint config for Next.js and TypeScript; fix the findings (1 h)
- [ ] Workflow: lint, typecheck, tests and Docker build on every push and pull request (1 h)
- [ ] Build arm64 images in CI so they run on the Pi (0.5 h)

### 3.5 End-to-end smoke test (1 h)

- [ ] Playwright test: log in, see devices, toggle a light through a fake broker (1 h)

---

## Phase 4: Automation features (~25 h)

### 4.1 Schedules (4 h)

- [ ] Schedule model: days of week, time, target device, action (1 h)
- [ ] Scheduler in the app process that runs due schedules and survives restarts (1.5 h)
- [ ] Schedules page for admins (1 h)
- [ ] Tests, including daylight saving time changes (0.5 h)

### 4.2 Compound rule conditions (4 h)

- [ ] Rules with several conditions joined by AND / OR (1.5 h)
- [ ] Time-window conditions (e.g. only between 22:00 and 06:00) (1 h)
- [ ] Rules form for building conditions (1 h)
- [ ] Tests (0.5 h)

### 4.3 Scenes (3 h)

- [ ] Scene model: a named set of device commands ("Night", "Movie") (1 h)
- [ ] Run a scene from the dashboard or from a rule or schedule (1 h)
- [ ] Scene editor and tests (1 h)

### 4.4 Away mode (2 h)

- [ ] Home-wide away mode that lowers heater setpoints and turns off lights (1 h)
- [ ] Rules and schedules can depend on away mode (1 h)

### 4.5 Rule activity log (3 h)

- [ ] Record each rule or schedule firing with its trigger value and action (1 h)
- [ ] Activity page with filters by device and rule (1.5 h)
- [ ] Retention for the activity log (0.5 h)

### 4.6 Sunrise and sunset triggers (2.5 h)

- [ ] Calculate sunrise and sunset locally from a configured latitude and longitude (no external service) (1 h)
- [ ] Schedules can use "sunset + 30 min" style times (1 h)
- [ ] Tests across seasons (0.5 h)

### 4.7 Weather-aware rules (3.5 h)

- [ ] Fetch the outdoor temperature and forecast from Open-Meteo (free, no API key) and cache it (1 h)
- [ ] Expose weather as a virtual sensor that rules can use (e.g. pre-heat when it will drop below 0 °C) (1.5 h)
- [ ] Handle the service being unreachable; tests (1 h)

### 4.8 Rule dry run (3 h)

- [ ] "Test rule" button that evaluates a rule against current device states without sending commands (1 h)
- [ ] Replay a day of device history through a rule to see when it would have fired (1.5 h)
- [ ] Tests (0.5 h)

---

## Phase 5: Dashboard and user experience (~21 h)

### 5.1 Rooms and device names (3 h)

- [ ] Room model; assign devices to rooms (1 h)
- [ ] Rename devices and change their type from the UI, keeping zigbee2mqtt friendly names in sync (1 h)
- [ ] Dashboard grouped by room (1 h)

### 5.2 Sensor history charts (4 h)

- [ ] API for history with a time range and resolution (1 h)
- [ ] Temperature and humidity charts per sensor (24 h / 7 d / 30 d) (2 h)
- [ ] Heater on/off periods shown on the temperature chart (1 h)

### 5.3 User management (4 h)

- [ ] Admin page to add users, change roles and remove users (2 h)
- [ ] Users can change their own password (1 h)
- [ ] Tests (1 h)

### 5.4 Mobile and PWA (3 h)

- [ ] Responsive layout pass for phones (1.5 h)
- [ ] Web app manifest and icons so it can be installed on a phone home screen (1 h)
- [ ] Reconnect the live update stream when the phone wakes up (0.5 h)

### 5.5 Device groups (3 h)

- [ ] Create zigbee2mqtt groups from the UI (e.g. "All living room lights") (1.5 h)
- [ ] Control a group from the dashboard and from rules (1 h)
- [ ] Tests (0.5 h)

### 5.6 Zigbee network map and firmware updates (4 h)

- [ ] Request the network map from the zigbee2mqtt bridge and draw it, showing link quality per device (2 h)
- [ ] Show devices with available firmware updates and start an update from the UI (admin only) (1.5 h)
- [ ] Show update progress and errors (0.5 h)

---

## Phase 6: Notifications and energy (~7 h)

### 6.1 Alerts (4 h)

- [ ] Alert rules: device offline, low battery, temperature out of range (1.5 h)
- [ ] Send through a self-hosted ntfy server, with a pluggable sender interface (1.5 h)
- [ ] Quiet hours and de-duplication (1 h)

### 6.2 Energy tracking (3 h)

- [ ] Record power and energy readings from smart plugs that report them (1 h)
- [ ] Daily and monthly usage per device with an optional price per kWh (1.5 h)
- [ ] Energy page (0.5 h)

---

## Phase 7: Operations and documentation (~10 h)

### 7.1 Backups (2 h)

- [ ] Nightly `pg_dump` container with rotation (1 h)
- [ ] Back up the zigbee2mqtt `data/` folder (device pairings) and document a restore (1 h)

### 7.2 Updates (2 h)

- [ ] Pin image versions and document the upgrade process for zigbee2mqtt, Mosquitto and Postgres (1 h)
- [ ] Database migrations run automatically on app start, with a failed-migration check (1 h)

### 7.3 API tokens and webhooks (4 h)

- [ ] Personal API tokens (hashed, revocable) for scripts and shortcuts on my phone (1.5 h)
- [ ] Outgoing webhooks when a rule fires or a device goes offline (1.5 h)
- [ ] Document the API in the README; tests (1 h)

### 7.4 Documentation (2 h)

- [ ] Architecture doc covering the MQTT topic flow, the rule engine and the live update stream (1 h)
- [ ] Guides for adding a new device type and writing rules (1 h)

---

## Phase 8: Heating control (~9 h)

### 8.1 Room target temperatures (4 h)

- [ ] Per-room target temperature with a weekly heating schedule (comfort / eco / off) (1.5 h)
- [ ] Controller that switches the room's heaters to reach the target, using the hysteresis from 1.3 (1.5 h)
- [ ] Room heating card on the dashboard with current vs target temperature (1 h)

### 8.2 Heater setpoint control (3 h)

- [ ] Detect heaters that accept a setpoint and show a temperature control instead of an on/off switch (1.5 h)
- [ ] Temporary override ("boost for 1 hour") that falls back to the schedule (1.5 h)

### 8.3 Open-window detection (2 h)

- [ ] Turn a room's heating off when a window contact sensor opens, or when temperature drops sharply (1.5 h)
- [ ] Resume heating when the window closes (0.5 h)

