import mqtt, { type MqttClient } from "mqtt";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deviceEvents, DEVICE_UPDATE_EVENT } from "@/lib/events";
import { inferDeviceType } from "@/lib/deviceType";
import { evaluateRulesForDevice } from "@/lib/ruleEngine";

const BASE_TOPIC = "zigbee2mqtt";

const globalForMqtt = globalThis as unknown as {
  mqttClient?: MqttClient;
  mqttStarted?: boolean;
};

/** Idempotent: safe to call multiple times (e.g. across HMR reloads in dev). */
export function startMqtt(): void {
  if (globalForMqtt.mqttStarted) return;
  globalForMqtt.mqttStarted = true;

  const url = process.env.MQTT_URL ?? "mqtt://localhost:1883";
  const client = mqtt.connect(url, {
    clientId: `home-automation-app-${Math.random().toString(16).slice(2)}`,
    reconnectPeriod: 2000,
  });
  globalForMqtt.mqttClient = client;

  client.on("connect", () => {
    console.log(`[mqtt] connected to ${url}`);
    client.subscribe(`${BASE_TOPIC}/#`, (err) => {
      if (err) console.error("[mqtt] subscribe error", err);
    });
  });

  client.on("reconnect", () => console.log("[mqtt] reconnecting..."));
  client.on("error", (err) => console.error("[mqtt] connection error", err));

  client.on("message", (topic, payload) => {
    handleMessage(topic, payload).catch((err) =>
      console.error(`[mqtt] failed handling message on ${topic}`, err)
    );
  });
}

// Per-device queue: handleStateMessage does a read-modify-write (find, merge
// in JS, upsert) that isn't atomic. Without this, two state messages for the
// same device arriving close together can interleave — both read the old
// state before either writes, and the second upsert silently clobbers fields
// the first one just merged in (a classic lost-update race).
const deviceQueues = new Map<string, Promise<void>>();

function runExclusive(key: string, fn: () => Promise<void>): Promise<void> {
  const prev = deviceQueues.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  deviceQueues.set(key, next);
  next.finally(() => {
    if (deviceQueues.get(key) === next) deviceQueues.delete(key);
  });
  return next;
}

async function handleMessage(topic: string, payload: Buffer): Promise<void> {
  if (!topic.startsWith(`${BASE_TOPIC}/`)) return;

  const rest = topic.slice(BASE_TOPIC.length + 1);
  const parts = rest.split("/");
  const friendlyName = parts[0];
  if (!friendlyName || friendlyName === "bridge") return;

  const raw = payload.toString();
  if (!raw) return;

  if (parts.length === 1) {
    await runExclusive(friendlyName, () => handleStateMessage(friendlyName, raw));
  } else if (parts.length === 2 && parts[1] === "availability") {
    await handleAvailabilityMessage(friendlyName, raw);
  }
}

async function handleStateMessage(friendlyName: string, raw: string): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const existing = await prisma.device.findUnique({ where: { friendlyName } });
  const mergedState = {
    ...(existing?.state as Record<string, unknown> | undefined),
    ...payload,
  } as Prisma.InputJsonObject;

  const device = await prisma.device.upsert({
    where: { friendlyName },
    update: { state: mergedState },
    create: {
      friendlyName,
      type: inferDeviceType(payload),
      state: mergedState,
    },
  });

  await prisma.deviceHistory.create({
    data: { deviceId: device.id, state: mergedState },
  });

  deviceEvents.emit(DEVICE_UPDATE_EVENT, device);
  await evaluateRulesForDevice(device);
}

async function handleAvailabilityMessage(friendlyName: string, raw: string): Promise<void> {
  let available: boolean;
  try {
    const parsed = JSON.parse(raw);
    available = parsed.state === "online";
  } catch {
    available = raw === "online";
  }

  const existing = await prisma.device.findUnique({ where: { friendlyName } });
  if (!existing) return;

  const device = await prisma.device.update({
    where: { friendlyName },
    data: { available },
  });

  deviceEvents.emit(DEVICE_UPDATE_EVENT, device);
}

/** Publishes a control command to zigbee2mqtt/<friendlyName>/set */
export function publishCommand(friendlyName: string, command: Record<string, unknown>): void {
  const client = globalForMqtt.mqttClient;
  if (!client || !client.connected) {
    console.error("[mqtt] cannot publish, client not connected");
    return;
  }
  client.publish(`${BASE_TOPIC}/${friendlyName}/set`, JSON.stringify(command));
}
