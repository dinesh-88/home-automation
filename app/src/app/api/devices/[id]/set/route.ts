import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishCommand } from "@/lib/mqtt";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "GUEST") {
    return NextResponse.json({ error: "Guests have view-only access" }, { status: 403 });
  }

  const { id } = await params;
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const command = body?.command;
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    return NextResponse.json({ error: "Body must be { command: { ... } }" }, { status: 400 });
  }

  if (!publishCommand(device.friendlyName, command)) {
    return NextResponse.json({ error: "MQTT broker not connected" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
