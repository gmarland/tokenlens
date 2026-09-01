import { NextResponse } from "next/server";
import { promptDetail } from "../../../../../lib/data";
import { promptInsight } from "../../../../../lib/insights";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "invalid prompt id" }, { status: 400 });
  const detail = await promptDetail(id);
  if (!detail?.prompt.repository_id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const models = [...new Set(detail.api.map((row: any) => row.model ?? detail.prompt.model).filter(Boolean))] as string[];
  const insights = await promptInsight(id, detail.prompt.repository_id, detail.prompt.provider, models.length === 1 ? models[0] : detail.prompt.model);
  return NextResponse.json({ insights });
}
