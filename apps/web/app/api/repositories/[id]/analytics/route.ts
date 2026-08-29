import { NextRequest, NextResponse } from "next/server";
import { repository } from "../../../../../lib/data";
import { correlations } from "@tokenlens/analytics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const model = req.nextUrl.searchParams.get("model") ?? undefined;
  const provider = req.nextUrl.searchParams.get("provider") ?? undefined;
  const x = await repository((await params).id, model, provider);
  if (!x) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!model)
    return NextResponse.json({ modelRequired: true, models: x.models, correlations: [] });
  return NextResponse.json({
    model,
    provider,
    n: x.prompts.length,
    correlations: correlations(
      x.prompts,
      (r: any) => Number(r.context_tokens),
      {
        workingSetLoc: (r: any) => Number(r.working_loc),
        filesRead: (r: any) => Number(r.files_read),
        repeatedReads: (r: any) => Number(r.repeated_reads),
        modules: (r: any) => Number(r.modules),
        fanOut: (r: any) => Number(r.mean_fan_out),
        toolResultBytes: (r: any) => Number(r.tool_bytes),
      },
    ),
  });
}
