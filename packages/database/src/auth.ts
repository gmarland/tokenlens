import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { IsNull } from "typeorm";
import { AgentInstallation, db, Workspace, WorkspaceApiKey } from "./index";

export const hashKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");

export type IngestIdentity = {
  workspace: Workspace;
  apiKey: WorkspaceApiKey;
  agent: AgentInstallation | null;
};

export async function authenticate(
  header: string | null,
  agentId?: string | null,
): Promise<IngestIdentity | null> {
  if (!header?.startsWith("Bearer ")) return null;
  const secret = header.slice(7);
  if (!secret) return null;
  const digest = hashKey(secret);
  const database = await db();
  const apiKey = await database.getRepository(WorkspaceApiKey).findOneBy({
    keyHash: digest,
    revokedAt: IsNull(),
  });
  if (!apiKey) return null;
  const stored = Buffer.from(apiKey.keyHash, "hex");
  const supplied = Buffer.from(digest, "hex");
  if (stored.length !== supplied.length || !timingSafeEqual(stored, supplied)) return null;

  let agent: AgentInstallation | null = null;
  if (agentId) {
    agent = await database.getRepository(AgentInstallation).findOneBy({
      id: agentId,
      workspaceId: apiKey.workspaceId,
      revokedAt: IsNull(),
    });
    if (!agent) return null;
  }
  const workspace = await database.getRepository(Workspace).findOneBy({ id: apiKey.workspaceId });
  if (!workspace) return null;

  const now = new Date();
  if (!apiKey.lastUsedAt || now.getTime() - apiKey.lastUsedAt.getTime() > 300_000) {
    void database.getRepository(WorkspaceApiKey).update(apiKey.id, { lastUsedAt: now }).catch(() => {});
  }
  if (agent && (!agent.lastSeenAt || now.getTime() - agent.lastSeenAt.getTime() > 300_000)) {
    void database.getRepository(AgentInstallation).update(agent.id, { lastSeenAt: now }).catch(() => {});
  }
  return { workspace, apiKey, agent };
}

export function generateApiKey() {
  const secret = `tlk_live_${randomBytes(32).toString("base64url")}`;
  return {
    secret,
    hash: hashKey(secret),
    prefix: `${secret.slice(0, 13)}…${secret.slice(-4)}`,
  };
}
