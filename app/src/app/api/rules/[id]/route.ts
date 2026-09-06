import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }
  return { session };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const data: Record<string, unknown> = {};
  if (typeof body?.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body?.name === "string") data.name = body.name;
  if (typeof body?.threshold === "number") data.threshold = body.threshold;
  if (typeof body?.operator === "string") data.operator = body.operator;
  if (typeof body?.metric === "string") data.metric = body.metric;
  if (typeof body?.action === "object" && body.action) data.action = body.action;
  if (body?.elseAction !== undefined) data.elseAction = body.elseAction;

  const rule = await prisma.rule.update({ where: { id }, data });
  return NextResponse.json(rule);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  await prisma.rule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
