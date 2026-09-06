import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Dashboard from "./components/Dashboard";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const devices = await prisma.device.findMany({ orderBy: { friendlyName: "asc" } });

  return <Dashboard initialDevices={devices} role={session.user.role} />;
}
