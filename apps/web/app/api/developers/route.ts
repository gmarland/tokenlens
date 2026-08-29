import { NextResponse } from "next/server";
import { developersList } from "../../../lib/data";
export async function GET() {
  return NextResponse.json(await developersList());
}
