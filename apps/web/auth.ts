import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
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
  Nodemailer({
    server: process.env.EMAIL_SERVER ?? "smtp://localhost:1025",
    from: process.env.EMAIL_FROM ?? "TokenLens <tokenlens@localhost>",
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  providers,
  pages: { signIn: "/login", verifyRequest: "/login/verify" },
  session: { strategy: "database" },
  trustHost: true,
  events: {
    async createUser({ user }) {
      if (user.id && user.email)
        await provisionUserWorkspace(user.id, user.email, user.name);
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (!session.user || !user.id || !user.email) return session;
      const access = await provisionUserWorkspace(
        user.id,
        user.email,
        user.name,
      );
      const sessionUser = session.user as typeof session.user & {
        workspaceId: string;
        workspaceName: string;
        workspaceRole: "owner" | "member";
      };
      sessionUser.id = user.id;
      sessionUser.workspaceId = access.workspaceId;
      sessionUser.workspaceName = access.workspaceName;
      sessionUser.workspaceRole = access.role;
      return session;
    },
  },
});
