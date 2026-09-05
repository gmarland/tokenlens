import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "pg";
import { provisionUserWorkspace } from "@tokenlens/database";

const globalForAuth = globalThis as unknown as { tokenLensAuthPool?: Pool };
const pool =
  globalForAuth.tokenLensAuthPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    options: "-c timezone=UTC",
  });
if (process.env.NODE_ENV !== "production")
  globalForAuth.tokenLensAuthPool = pool;

const providers = [
  Resend({
    apiKey: process.env.AUTH_RESEND_KEY,
    from: process.env.EMAIL_FROM ?? "TokenLens <onboarding@resend.dev>",
  }),
];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }) as never,
  );
}

export const authConfig = {
  adapter: PostgresAdapter(pool),
  providers,
  pages: { signIn: "/login", verifyRequest: "/login/verify" },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  trustHost: true,
  events: {
    async createUser({ user }) {
      if (user.id && user.email)
        await provisionUserWorkspace(user.id, user.email, user.name);
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        if (user.email) {
          await provisionUserWorkspace(user.id, user.email, user.name);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user || typeof token.userId !== "string") return session;
      session.user.id = token.userId;
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
