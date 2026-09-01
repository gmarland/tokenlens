import { NextRequest, NextResponse } from "next/server";
import { overview } from "../../../lib/data";
import { repositoryInsightBundle } from "../../../lib/insights";

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider") ?? undefined;
  const model = request.nextUrl.searchParams.get("model") ?? undefined;
  const data = await overview(model, provider);
  const insights = (await Promise.all(data.repositories.slice(0, 20).map(async (repository: any) =>
    (await repositoryInsightBundle(String(repository.id), { provider, model })).insights))).flat();
  return NextResponse.json({ insights });
}
