// Fake Zigbee2MQTT: publishes a small house of devices and reacts to /set
// commands like real devices do, so the app runs without a Zigbee adapter.
// The bedroom warms while its heater is ON and cools while it's OFF, which is
// enough to exercise temperature rules end to end.
import mqtt from "mqtt";

const BASE = "zigbee2mqtt";
const url = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const tickMs = Number(process.env.SIM_TICK_MS ?? 5000);

const devices = {
  living_room_light: { state: "ON", brightness: 200, color_temp: 300, linkquality: 120 },
  kitchen_light: { state: "OFF", brightness: 120, linkquality: 98 },
  bedroom_heater: { state: "OFF", local_temperature: 19.5, current_heating_setpoint: 21, linkquality: 87 },
  bedroom_sensor: { temperature: 19.5, humidity: 48, battery: 91, linkquality: 76 },
  hallway_motion: { occupancy: false, battery: 64, linkquality: 60 },
};

const client = mqtt.connect(url, { clientId: `z2m-simulator-${process.pid}`, reconnectPeriod: 2000 });

// Retained (z2m's `retain: true` device option) so an app started later still sees every device.
const publish = (name) => client.publish(`${BASE}/${name}`, JSON.stringify(devices[name]), { retain: true });
const round1 = (n) => Math.round(n * 10) / 10;

client.on("connect", () => {
  console.log(`[sim] connected to ${url}, simulating ${Object.keys(devices).length} devices`);
  client.subscribe(`${BASE}/+/set`);
  for (const name of Object.keys(devices)) {
    client.publish(`${BASE}/${name}/availability`, JSON.stringify({ state: "online" }), { retain: true });
    publish(name);
  }
});

client.on("message", (topic, payload) => {
  const name = topic.split("/")[1];
  if (!devices[name]) return;
  let command;
  try {
    command = JSON.parse(payload.toString());
  } catch {
    return;
  }
  if (!command || typeof command !== "object" || Array.isArray(command)) return;
  // Real devices only accept keys they know; ignore anything else.
  for (const [key, value] of Object.entries(command)) {
    if (key in devices[name] && key !== "linkquality") devices[name][key] = value;
  }
  publish(name);
});

setInterval(() => {
  if (!client.connected) return;
  const heater = devices.bedroom_heater;
  const sensor = devices.bedroom_sensor;
  const drift = heater.state === "ON" ? 0.15 : -0.08;
  const temp = round1(Math.min(30, Math.max(12, sensor.temperature + drift + (Math.random() - 0.5) * 0.04)));
  sensor.temperature = temp;
  sensor.humidity = round1(Math.min(70, Math.max(30, sensor.humidity + (Math.random() - 0.5))));
  heater.local_temperature = temp;
  publish("bedroom_sensor");
  publish("bedroom_heater");

  if (Math.random() < 0.2) {
    devices.hallway_motion.occupancy = !devices.hallway_motion.occupancy;
    publish("hallway_motion");
  }
}, tickMs);
