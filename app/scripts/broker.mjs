// Stand-in for Mosquitto where Docker isn't available: an in-memory MQTT broker.
// shortcut: anonymous, no persistence, no TLS; use real Mosquitto on the Pi.
import { createServer } from "node:net";
import Aedes from "aedes";

const port = Number(process.env.MQTT_PORT ?? 1883);
const broker = Aedes();
const server = createServer(broker.handle);

server.listen(port, "127.0.0.1", () => console.log(`[broker] MQTT listening on 127.0.0.1:${port}`));
