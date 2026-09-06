import { EventEmitter } from "node:events";

const globalForEvents = globalThis as unknown as { deviceEvents?: EventEmitter };

// Next.js bundles each route handler (and instrumentation.ts) into separate
// compiled chunks even for a single self-hosted `next start` process, so a
// plain module-level singleton wouldn't be shared between them. Always
// stash it on globalThis (not just in dev) so mqtt.ts's emitter and the SSE
// route's listener are provably the same EventEmitter instance.
export const deviceEvents = globalForEvents.deviceEvents ?? new EventEmitter();
deviceEvents.setMaxListeners(0);
globalForEvents.deviceEvents = deviceEvents;

export const DEVICE_UPDATE_EVENT = "device-update";
