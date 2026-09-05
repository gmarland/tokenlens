import { writeFile } from "node:fs/promises";
import { config as loadEnvironment } from "dotenv";
import { encode } from "next-auth/jwt";
import { Pool } from "pg";

loadEnvironment({ path: new URL("../../../.env", import.meta.url), quiet: true });

const AUTH_STATE_PATH = "/tmp/tokenlens-playwright-auth.json";
const USER_ID = "00000000-0000-4000-8000-000000000099";
const MAX_AGE = 7 * 24 * 60 * 60;

export default async function globalSetup() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://tokenlens:tokenlens@localhost:5432/tokenlens",
    options: "-c timezone=UTC",
  });
  try {
    const workspace = await pool.query<{ id: string }>(
      "select id from workspaces order by created_at limit 1",
    );
    const workspaceId = workspace.rows[0]?.id;
    if (!workspaceId) throw new Error("Playwright authentication requires a seeded workspace");

    await pool.query(
      `insert into users(id,name,email,"emailVerified")
       values($1,'Playwright Owner','playwright@tokenlens.test',now())
       on conflict(id) do update set name=excluded.name,email=excluded.email,"emailVerified"=excluded."emailVerified"`,
      [USER_ID],
    );
    await pool.query(
      `insert into workspace_memberships(workspace_id,user_id,role)
       values($1,$2,'owner')
       on conflict(workspace_id,user_id) do update set role='owner'`,
      [workspaceId, USER_ID],
    );
  } finally {
    await pool.end();
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for Playwright authentication");
  const cookieName = "authjs.session-token";
  const value = await encode({
    salt: cookieName,
    secret,
    maxAge: MAX_AGE,
    token: {
      sub: USER_ID,
      userId: USER_ID,
      name: "Playwright Owner",
      email: "playwright@tokenlens.test",
    },
  });
  await writeFile(
    AUTH_STATE_PATH,
    JSON.stringify({
      cookies: [{
        name: cookieName,
        value,
        domain: "127.0.0.1",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + MAX_AGE,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      }],
      origins: [],
    }),
  );
}
