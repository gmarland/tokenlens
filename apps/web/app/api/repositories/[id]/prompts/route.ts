import { NextRequest, NextResponse } from "next/server";
import { repositoryPrompts } from "../../../../../lib/data";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const q = req.nextUrl.searchParams;
  return NextResponse.json(
    await repositoryPrompts(
      (await params).id,
      q.get("sort") ?? undefined,
      q.get("model") ?? undefined,
      q.get("provider") ?? undefined,
    ),
  );
}
