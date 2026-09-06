"use client";

import { useState } from "react";
import type { Device, Prisma } from "@prisma/client";

type RuleWithDevices = Prisma.RuleGetPayload<{ include: { sourceDevice: true; targetDevice: true } }>;

const OPERATORS = ["LT", "LTE", "GT", "GTE", "EQ"] as const;
const OPERATOR_LABELS: Record<(typeof OPERATORS)[number], string> = {
  LT: "<",
  LTE: "≤",
  GT: ">",
  GTE: "≥",
  EQ: "=",
};

export default function RulesManager({
  initialRules,
  devices,
}: {
  initialRules: RuleWithDevices[];
  devices: Device[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [sourceDeviceId, setSourceDeviceId] = useState(devices[0]?.id ?? "");
  const [metric, setMetric] = useState("local_temperature");
  const [operator, setOperator] = useState<(typeof OPERATORS)[number]>("LT");
  const [threshold, setThreshold] = useState(20);
  const [targetDeviceId, setTargetDeviceId] = useState(devices[0]?.id ?? "");
  const [action, setAction] = useState('{"state":"ON"}');
  const [elseAction, setElseAction] = useState('{"state":"OFF"}');

  async function refreshRules() {
    const res = await fetch("/api/rules");
    if (res.ok) setRules(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let parsedAction: unknown;
    let parsedElseAction: unknown;
    try {
      parsedAction = JSON.parse(action);
      parsedElseAction = elseAction.trim() ? JSON.parse(elseAction) : null;
    } catch {
      setError("Action / else action must be valid JSON, e.g. {\"state\":\"ON\"}");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sourceDeviceId,
        metric,
        operator,
        threshold,
        targetDeviceId,
        action: parsedAction,
        elseAction: parsedElseAction,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create rule");
      return;
    }

    setName("");
    await refreshRules();
  }

  async function toggleEnabled(rule: RuleWithDevices) {
    await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    await refreshRules();
  }

  async function deleteRule(rule: RuleWithDevices) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
    await refreshRules();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-white mb-1">Rules</h1>
        <p className="text-sm text-slate-400">
          Example: if <code className="bg-slate-800 px-1 rounded">local_temperature</code> on a sensor is
          less than 20, turn a heater ON — otherwise OFF.
        </p>
      </div>

      <form onSubmit={handleCreate} className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4">
        <h2 className="font-medium text-white">New rule</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Heater auto-on when cold"
              className="input"
            />
          </Field>

          <Field label="Source device (sensor)">
            <select value={sourceDeviceId} onChange={(e) => setSourceDeviceId(e.target.value)} className="input">
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.friendlyName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Metric (state field)">
            <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="local_temperature" className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Operator">
              <select value={operator} onChange={(e) => setOperator(e.target.value as (typeof OPERATORS)[number])} className="input">
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Threshold">
              <input
                type="number"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="input"
              />
            </Field>
          </div>

          <Field label="Target device (actuator)">
            <select value={targetDeviceId} onChange={(e) => setTargetDeviceId(e.target.value)} className="input">
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.friendlyName}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Action (JSON, when condition is true)">
            <input value={action} onChange={(e) => setAction(e.target.value)} className="input font-mono text-xs" />
          </Field>

          <Field label="Else action (JSON, optional)">
            <input value={elseAction} onChange={(e) => setElseAction(e.target.value)} className="input font-mono text-xs" />
          </Field>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || devices.length === 0}
          className="self-start rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create rule"}
        </button>
        {devices.length === 0 && (
          <p className="text-xs text-slate-500">No devices available yet — pair a Zigbee device first.</p>
        )}
      </form>

      <div className="flex flex-col gap-3">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-white">{rule.name}</p>
              <p className="text-xs text-slate-400 mt-1">
                {rule.sourceDevice.friendlyName}.{rule.metric} {OPERATOR_LABELS[rule.operator]} {rule.threshold} →{" "}
                {rule.targetDevice.friendlyName} {JSON.stringify(rule.action)}
                {rule.elseAction ? ` (else ${JSON.stringify(rule.elseAction)})` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => toggleEnabled(rule)}
                className={`text-xs px-2 py-1 rounded ${
                  rule.enabled ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-400"
                }`}
              >
                {rule.enabled ? "Enabled" : "Disabled"}
              </button>
              <button onClick={() => deleteRule(rule)} className="text-xs text-red-400 hover:text-red-300">
                Delete
              </button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="text-sm text-slate-400">No rules yet.</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-300">
      {label}
      {children}
    </label>
  );
}
