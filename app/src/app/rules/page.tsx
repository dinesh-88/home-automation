import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import RulesManager from "./RulesManager";

export default async function RulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const [rules, devices] = await Promise.all([
    prisma.rule.findMany({
      include: { sourceDevice: true, targetDevice: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.device.findMany({ orderBy: { friendlyName: "asc" } }),
  ]);

  return <RulesManager initialRules={rules} devices={devices} />;
}
