import type { DeviceType } from "@prisma/client";

/**
 * Zigbee2MQTT doesn't label device "type" in state payloads, so we infer a
 * coarse type from the keys present the first time we see a device. This is
 * only used to pick a sensible dashboard widget — it never overwrites a type
 * that was already inferred (see mqtt.ts).
 */
export function inferDeviceType(state: Record<string, unknown>): DeviceType {
  const keys = Object.keys(state);

  const hasHeaterKeys = keys.some((k) =>
    ["current_heating_setpoint", "occupied_heating_setpoint", "local_temperature"].includes(k)
  );
  if (hasHeaterKeys) return "HEATER";

  const hasLightKeys = keys.some((k) => ["brightness", "color_temp", "color"].includes(k));
  if (hasLightKeys) return "LIGHT";

  const hasSensorKeys = keys.some((k) =>
    ["temperature", "humidity", "occupancy", "contact", "illuminance", "battery"].includes(k)
  );
  if (hasSensorKeys) return "SENSOR";

  if (keys.includes("state") && keys.length <= 2) return "LIGHT";

  return "OTHER";
}
