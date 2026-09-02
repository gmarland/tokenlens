import { NextRequest, NextResponse } from "next/server";
import { repositoryInsightBundle, scopedInsightFilter } from "../../../../../lib/insights";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "invalid repository id" }, { status: 400 });
  const bundle = await repositoryInsightBundle(id, scopedInsightFilter({
    provider: request.nextUrl.searchParams.get("provider") ?? undefined,
    model: request.nextUrl.searchParams.get("model") ?? undefined,
    branch: request.nextUrl.searchParams.get("branch") ?? undefined,
    range: request.nextUrl.searchParams.get("range") ?? undefined,
  }));
  return NextResponse.json({ insights: bundle.insights, sampleSize: bundle.facts.length });
}
