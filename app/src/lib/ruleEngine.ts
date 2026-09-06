import type { Device, RuleOperator } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishCommand } from "@/lib/mqtt";

function compare(value: number, operator: RuleOperator, threshold: number): boolean {
  switch (operator) {
    case "LT":
      return value < threshold;
    case "LTE":
      return value <= threshold;
    case "GT":
      return value > threshold;
    case "GTE":
      return value >= threshold;
    case "EQ":
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Runs whenever a device's state changes. Finds rules whose source device is
 * this device, evaluates the condition against the new state, and publishes
 * the resulting action to the target device — but only if the target isn't
 * already in that state, to avoid spamming the MQTT bus.
 *
 * Example: rule { source: livingroom_sensor, metric: temperature, operator: LT,
 * threshold: 20, target: livingroom_heater, action: {state: "ON"}, elseAction: {state: "OFF"} }
 */
export async function evaluateRulesForDevice(device: Device): Promise<void> {
  const rules = await prisma.rule.findMany({
    where: { sourceDeviceId: device.id, enabled: true },
    include: { targetDevice: true },
  });

  if (rules.length === 0) return;

  const state = device.state as Record<string, unknown>;

  for (const rule of rules) {
    const rawValue = state[rule.metric];
    if (typeof rawValue !== "number") continue;

    const matches = compare(rawValue, rule.operator, rule.threshold);
    const action = (matches ? rule.action : rule.elseAction) as Record<string, unknown> | null;
    if (!action || Object.keys(action).length === 0) continue;

    const targetState = rule.targetDevice.state as Record<string, unknown>;
    const alreadyApplied = Object.entries(action).every(([k, v]) => targetState?.[k] === v);
    if (alreadyApplied) continue;

    console.log(
      `[rule-engine] "${rule.name}" fired: ${device.friendlyName}.${rule.metric}=${rawValue} -> ${rule.targetDevice.friendlyName}`,
      action
    );
    publishCommand(rule.targetDevice.friendlyName, action);
  }
}
