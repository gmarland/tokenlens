import { NextResponse } from "next/server";
import { setRepositoryInsightState } from "@tokenlens/database/analytics";
import type { InsightState } from "@tokenlens/shared";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const states = new Set<InsightState>(["new", "acknowledged", "monitoring", "dismissed", "resolved"]);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  if (typeof body.repositoryId !== "string" || !uuid.test(body.repositoryId) ||
      typeof body.insightId !== "string" || body.insightId.length > 1_000 ||
      typeof body.state !== "string" || !states.has(body.state as InsightState)) {
    return NextResponse.json({ error: "invalid insight state" }, { status: 400 });
  }
  const result = await setRepositoryInsightState(body.repositoryId, body.insightId, body.state as InsightState);
  return result ? NextResponse.json(result) : NextResponse.json({ error: "repository not found" }, { status: 404 });
}
