import { NextRequest, NextResponse } from "next/server";
import { repository } from "../../../../lib/data";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const x = await repository(
    (await params).id,
    req.nextUrl.searchParams.get("model") ?? undefined,
    req.nextUrl.searchParams.get("provider") ?? undefined,
  );
  return x
    ? NextResponse.json(x)
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
