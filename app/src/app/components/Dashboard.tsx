"use client";

import { useEffect, useState } from "react";
import type { Device } from "@prisma/client";
import type { AppRole } from "@/types/next-auth";
import DeviceCard from "./DeviceCard";

export default function Dashboard({
  initialDevices,
  role,
}: {
  initialDevices: Device[];
  role: AppRole;
}) {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const updated: Device = JSON.parse(event.data);
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.id === updated.id);
        if (idx === -1) return [...prev, updated].sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    };

    return () => source.close();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Devices</h1>
        <span className={`text-xs px-2 py-1 rounded ${connected ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
          {connected ? "live" : "connecting…"}
        </span>
      </div>

      {devices.length === 0 && (
        <p className="text-sm text-slate-400">
          No devices yet. Pair a Zigbee device via Zigbee2MQTT and it will appear here automatically.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => (
          <DeviceCard key={device.id} device={device} role={role} />
        ))}
      </div>
    </div>
  );
}
