import { NextRequest, NextResponse } from "next/server";
import { overview } from "../../../lib/data";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return NextResponse.json(
    (
      await overview(
        q.get("model") ?? undefined,
        q.get("provider") ?? undefined,
      )
    ).repositories,
  );
}
