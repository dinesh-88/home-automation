import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALID_OPERATORS = ["LT", "LTE", "GT", "GTE", "EQ"] as const;
type ValidOperator = (typeof VALID_OPERATORS)[number];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const rules = await prisma.rule.findMany({
    include: { sourceDevice: true, targetDevice: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { name, sourceDeviceId, metric, operator, threshold, targetDeviceId, action, elseAction } =
    body ?? {};

  if (
    typeof name !== "string" ||
    typeof sourceDeviceId !== "string" ||
    typeof metric !== "string" ||
    typeof operator !== "string" ||
    !VALID_OPERATORS.includes(operator as ValidOperator) ||
    typeof threshold !== "number" ||
    typeof targetDeviceId !== "string" ||
    typeof action !== "object"
  ) {
    return NextResponse.json({ error: "Invalid rule payload" }, { status: 400 });
  }

  const rule = await prisma.rule.create({
    data: {
      name,
      sourceDeviceId,
      metric,
      operator: operator as ValidOperator,
      threshold,
      targetDeviceId,
      action,
      elseAction: elseAction ?? undefined,
    },
  });

  return NextResponse.json(rule, { status: 201 });
}
