import { NextResponse } from "next/server";
import { developersList } from "../../../lib/data";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return NextResponse.json(await developersList(
    query.get("model") || undefined,
    query.get("provider") || undefined,
  ));
}
