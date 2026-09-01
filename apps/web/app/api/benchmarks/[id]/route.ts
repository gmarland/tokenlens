import { NextResponse } from "next/server";
import { archiveBenchmark, benchmarkDetail } from "../../../../lib/data";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "invalid benchmark id" }, { status: 400 });
  const result = await benchmarkDetail(id);
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "invalid benchmark id" }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  if (body.archived !== true) {
    return NextResponse.json({ error: "only archiving is supported" }, { status: 400 });
  }
  const result = await archiveBenchmark(id);
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "not found" }, { status: 404 });
}
