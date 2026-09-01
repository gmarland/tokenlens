import { NextResponse } from "next/server";
import {
  BenchmarkValidationError,
  createPromptBenchmark,
  repositoryBenchmarks,
} from "../../../../../lib/data";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "invalid repository id" }, { status: 400 });
  return NextResponse.json(await repositoryBenchmarks(id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "invalid repository id" }, { status: 400 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.sourcePromptId !== "string" || !uuid.test(body.sourcePromptId)) {
      return NextResponse.json({ error: "invalid source prompt id" }, { status: 400 });
    }
    if (body.model != null && typeof body.model !== "string") {
      return NextResponse.json({ error: "invalid model" }, { status: 400 });
    }
    if (body.name != null && typeof body.name !== "string") {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }
    const model = typeof body.model === "string" ? body.model : undefined;
    const name = typeof body.name === "string" ? body.name : undefined;
    const benchmark = await createPromptBenchmark(id, body.sourcePromptId, model, name);
    return NextResponse.json(benchmark, { status: 201 });
  } catch (error) {
    if (error instanceof BenchmarkValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
    throw error;
  }
}
