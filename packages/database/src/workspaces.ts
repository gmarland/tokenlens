import { randomBytes } from "node:crypto";
import { db } from "./index";
import { generateApiKey, hashKey } from "./auth";

export type WorkspaceAccess = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  role: "owner" | "member";
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export type UserProfile = {
  id: string;
  name: string;
  email: string;
};

export async function updateUserProfile(
  userId: string,
  input: { name: string; email: string },
): Promise<UserProfile | null> {
  const database = await db();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const rows = await database.query(
    `update users
     set name=$2,
         email=$3,
         "emailVerified"=case when email is distinct from $3 then null else "emailVerified" end
     where id=$1
     returning id,name,email`,
    [userId, name, email],
  ) as UserProfile[];
  return rows[0] ?? null;
}

export async function provisionUserWorkspace(userId: string, email: string, name?: string | null) {
  const database = await db();
  return database.transaction(async (manager) => {
    const existing = await manager.query(
      `select m.user_id "userId",m.workspace_id "workspaceId",w.name "workspaceName",m.role
       from workspace_memberships m join workspaces w on w.id=m.workspace_id
       where m.user_id=$1 order by m.created_at desc limit 1`,
      [userId],
    ) as WorkspaceAccess[];
    if (existing[0]) {
      const normalizedEmail = normalizeEmail(email);
      await manager.query(
        `insert into workspace_memberships(workspace_id,user_id,role)
         select i.workspace_id,$1,i.role from workspace_invitations i
         where lower(i.email)=$2 and i.accepted_at is null and i.expires_at>now()
         on conflict(workspace_id,user_id) do nothing`,
        [userId, normalizedEmail],
      );
      await manager.query(
        `update workspace_invitations set accepted_at=now()
         where lower(email)=$1 and accepted_at is null and expires_at>now()`,
        [normalizedEmail],
      );
      return existing[0];
    }

    const normalizedEmail = normalizeEmail(email);
    const bootstrapEmail = normalizeEmail(
      process.env.TOKENLENS_BOOTSTRAP_OWNER_EMAIL ?? "gareth.marland@gmail.com",
    );
    let workspaceId: string | undefined;
    let workspaceName: string | undefined;
    if (normalizedEmail === bootstrapEmail) {
      const candidates = await manager.query(
        `select w.id,w.name from workspaces w
         where not exists(select 1 from workspace_memberships m where m.workspace_id=w.id)
         order by w.created_at limit 1 for update`,
      ) as { id: string; name: string }[];
      workspaceId = candidates[0]?.id;
      workspaceName = candidates[0]?.name;
    }

    if (!workspaceId) {
      const label = name?.trim().split(/\s+/)[0] || normalizedEmail.split("@")[0];
      const created = await manager.query(
        `insert into workspaces(name,ingest_key_hash) values($1,$2) returning id,name`,
        [`${label}'s workspace`, hashKey(`disabled_${randomBytes(32).toString("hex")}`)],
      ) as { id: string; name: string }[];
      workspaceId = created[0].id;
      workspaceName = created[0].name;
    }

    await manager.query(
      `insert into workspace_memberships(workspace_id,user_id,role)
       values($1,$2,'owner') on conflict(workspace_id,user_id) do nothing`,
      [workspaceId, userId],
    );
    await manager.query(
      `insert into workspace_memberships(workspace_id,user_id,role)
       select i.workspace_id,$1,i.role from workspace_invitations i
       where lower(i.email)=$2 and i.accepted_at is null and i.expires_at>now()
       on conflict(workspace_id,user_id) do nothing`,
      [userId, normalizedEmail],
    );
    await manager.query(
      `update workspace_invitations set accepted_at=now()
       where lower(email)=$1 and accepted_at is null and expires_at>now()`,
      [normalizedEmail],
    );
    return { userId, workspaceId, workspaceName: workspaceName!, role: "owner" as const };
  });
}

export async function workspaceAccess(userId: string, requestedWorkspaceId?: string | null): Promise<WorkspaceAccess | null> {
  const database = await db();
  const parameters: unknown[] = [userId];
  const requested = requestedWorkspaceId ? `and m.workspace_id=$${parameters.push(requestedWorkspaceId)}` : "";
  const rows = await database.query(
    `select m.user_id "userId",m.workspace_id "workspaceId",w.name "workspaceName",m.role
     from workspace_memberships m join workspaces w on w.id=m.workspace_id
     where m.user_id=$1 ${requested}
     order by m.created_at desc limit 1`,
    parameters,
  ) as WorkspaceAccess[];
  return rows[0] ?? null;
}

export async function listWorkspaceApiKeyManagementData(workspaceId: string) {
  const database = await db();
  const [keys, agents] = await Promise.all([
    database.query(`select id,name,key_prefix,created_at,last_used_at,revoked_at from workspace_api_keys where workspace_id=$1 order by created_at desc`, [workspaceId]),
    database.query(`select id,name,providers,cli_version,created_at,last_seen_at,revoked_at from agent_installations where workspace_id=$1 order by created_at desc`, [workspaceId]),
  ]);
  return { keys, agents };
}

export async function listWorkspaceMembers(workspaceId: string) {
  const database = await db();
  return database.query(
    `select u.id,u.name,u.email,m.role,m.created_at
     from workspace_memberships m join users u on u.id=m.user_id
     where m.workspace_id=$1 order by m.created_at`,
    [workspaceId],
  );
}

export async function listWorkspaceInvitations(workspaceId: string) {
  const database = await db();
  return database.query(
    `select i.id,i.email,i.role,i.created_at,i.expires_at,
            case when i.expires_at<=now() then 'expired' else 'invited' end status
     from workspace_invitations i
     where i.workspace_id=$1
       and i.accepted_at is null
       and not exists(
         select 1
         from workspace_memberships m join users u on u.id=m.user_id
         where m.workspace_id=i.workspace_id and lower(u.email)=lower(i.email)
       )
     order by i.created_at desc`,
    [workspaceId],
  );
}

export async function createWorkspaceApiKey(workspaceId: string, userId: string, name: string) {
  const key = generateApiKey();
  const database = await db();
  const rows = await database.query(
    `insert into workspace_api_keys(workspace_id,key_hash,key_prefix,name,created_by_user_id)
     values($1,$2,$3,$4,$5) returning id,name,key_prefix,created_at`,
    [workspaceId, key.hash, key.prefix, name.trim().slice(0, 80) || "CLI key", userId],
  );
  return { ...rows[0], secret: key.secret };
}

export async function revokeWorkspaceApiKey(workspaceId: string, keyId: string) {
  const database = await db();
  const active = await database.query(
    `select count(*)::int count from workspace_api_keys where workspace_id=$1 and revoked_at is null`,
    [workspaceId],
  ) as { count: number }[];
  if (Number(active[0]?.count ?? 0) <= 1) throw new Error("Create a replacement key before revoking the last active key");
  const rows = await database.query(
    `update workspace_api_keys set revoked_at=now() where id=$1 and workspace_id=$2 and revoked_at is null returning id`,
    [keyId, workspaceId],
  );
  return rows[0] ?? null;
}

export async function createWorkspaceInvitation(
  workspaceId: string,
  userId: string,
  email: string,
  role: "owner" | "member",
) {
  const normalizedEmail = normalizeEmail(email);
  const token = randomBytes(32).toString("base64url");
  const database = await db();
  const rows = await database.query(
    `insert into workspace_invitations(workspace_id,email,role,token_hash,invited_by_user_id,expires_at)
     select $1,$3,$4,$5,$2,now()+interval '7 days'
     where not exists(
       select 1
       from workspace_memberships m join users u on u.id=m.user_id
       where m.workspace_id=$1 and lower(u.email)=$3
     )
     on conflict(workspace_id,lower(email)) where accepted_at is null
     do update set role=excluded.role,token_hash=excluded.token_hash,invited_by_user_id=excluded.invited_by_user_id,created_at=now(),expires_at=excluded.expires_at
     returning id,email,role,created_at,expires_at`,
    [workspaceId, userId, normalizedEmail, role, hashKey(token)],
  );
  if (!rows[0]) return null;
  return { ...rows[0], status: "invited" as const, token };
}

export async function revokeAgentInstallation(workspaceId: string, agentId: string) {
  const database = await db();
  const rows = await database.query(
    `update agent_installations set revoked_at=now() where id=$1 and workspace_id=$2 and revoked_at is null returning id`,
    [agentId, workspaceId],
  );
  return rows[0] ?? null;
}
