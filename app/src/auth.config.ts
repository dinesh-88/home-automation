import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Edge-safe config (no Prisma/bcrypt). Consumed by middleware.ts directly and
 * merged with the Credentials provider + DB logic in auth.ts for the Node runtime.
 *
 * jwt/session callbacks live here (not just in auth.ts) because middleware.ts
 * builds its own NextAuth instance from this config alone — if role-mapping
 * only existed in auth.ts, auth.user.role would be undefined in middleware,
 * silently failing the ADMIN check below for every user.
 */
export default {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/login")) return true;

      if (!isLoggedIn) return false;

      if (pathname.startsWith("/rules") && auth?.user?.role !== "ADMIN") {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as JWT;
      if (session.user) {
        session.user.id = t.id ?? "";
        session.user.role = t.role ?? "GUEST";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
