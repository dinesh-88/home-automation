"use client";

import { useState } from "react";
import type { Device } from "@prisma/client";
import type { AppRole } from "@/types/next-auth";

type DeviceState = Record<string, unknown>;

function num(state: DeviceState, key: string): number | undefined {
  const v = state[key];
  return typeof v === "number" ? v : undefined;
}

export default function DeviceCard({ device, role }: { device: Device; role: AppRole }) {
  const [pending, setPending] = useState(false);
  const state = device.state as DeviceState;
  const canControl = role === "ADMIN" || role === "USER";

  async function sendCommand(command: Record<string, unknown>) {
    if (!canControl) return;
    setPending(true);
    try {
      await fetch(`/api/devices/${device.id}/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
    } finally {
      setPending(false);
    }
  }

  const isOn = state.state === "ON";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-white">{device.friendlyName}</h3>
          <p className="text-xs text-slate-500 uppercase tracking-wide">{device.type}</p>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full mt-1 ${device.available ? "bg-emerald-500" : "bg-slate-600"}`}
          title={device.available ? "online" : "offline"}
        />
      </div>

      {device.type === "LIGHT" && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">{isOn ? "On" : "Off"}</span>
          <button
            disabled={!canControl || pending}
            onClick={() => sendCommand({ state: isOn ? "OFF" : "ON" })}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isOn ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-slate-700 text-slate-200 hover:bg-slate-600"
            }`}
          >
            {isOn ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}

      {device.type === "HEATER" && (
        <HeaterControls state={state} canControl={canControl} pending={pending} onSend={sendCommand} />
      )}

      {(device.type === "SENSOR" || device.type === "OTHER") && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(state).map(([k, v]) => (
            <span key={k} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
              {k}: {String(v)}
            </span>
          ))}
          {Object.keys(state).length === 0 && <span className="text-xs text-slate-500">No data yet</span>}
        </div>
      )}
    </div>
  );
}

function HeaterControls({
  state,
  canControl,
  pending,
  onSend,
}: {
  state: DeviceState;
  canControl: boolean;
  pending: boolean;
  onSend: (command: Record<string, unknown>) => void;
}) {
  const currentTemp = num(state, "local_temperature");
  const setpoint = num(state, "current_heating_setpoint") ?? 20;
  const isOn = state.state === "ON";
  const [draftSetpoint, setDraftSetpoint] = useState(setpoint);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">
          {currentTemp !== undefined ? `${currentTemp.toFixed(1)}°C now` : "No reading yet"}
        </span>
        <button
          disabled={!canControl || pending}
          onClick={() => onSend({ state: isOn ? "OFF" : "ON" })}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            isOn ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-slate-700 text-slate-200 hover:bg-slate-600"
          }`}
        >
          {isOn ? "On" : "Off"}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={5}
          max={30}
          step={0.5}
          value={draftSetpoint}
          disabled={!canControl || pending}
          onChange={(e) => setDraftSetpoint(parseFloat(e.target.value))}
          onMouseUp={() => onSend({ current_heating_setpoint: draftSetpoint })}
          onTouchEnd={() => onSend({ current_heating_setpoint: draftSetpoint })}
          className="flex-1 accent-amber-500 disabled:opacity-40"
        />
        <span className="text-sm text-slate-300 w-14 text-right">{draftSetpoint.toFixed(1)}°C</span>
      </div>
    </div>
  );
}
