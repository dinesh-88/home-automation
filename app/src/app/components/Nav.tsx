import Link from "next/link";
import { auth } from "@/auth";
import SignOutButton from "./SignOutButton";

export default async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <nav className="border-b border-slate-800 bg-slate-900/60">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-white">🏠 Home Automation</span>
          <Link href="/" className="text-sm text-slate-300 hover:text-white">
            Dashboard
          </Link>
          {session.user.role === "ADMIN" && (
            <Link href="/rules" className="text-sm text-slate-300 hover:text-white">
              Rules
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-wide text-slate-400 bg-slate-800 px-2 py-1 rounded">
            {session.user.role}
          </span>
          <span className="text-sm text-slate-400">{session.user.email}</span>
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
