import { NextResponse } from "next/server";
import { benchmarkInsight } from "../../../../../lib/insights";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "invalid benchmark id" }, { status: 400 });
  const result = await benchmarkInsight(id);
  return result ? NextResponse.json({ insights: result.insights }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
