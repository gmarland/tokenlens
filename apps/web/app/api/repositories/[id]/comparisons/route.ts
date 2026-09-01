import { NextResponse } from "next/server";
import { repositoryInsightBundle } from "../../../../../lib/insights";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "invalid repository id" }, { status: 400 });
  const bundle = await repositoryInsightBundle(id);
  return NextResponse.json({ comparisons: bundle.comparisons });
}
