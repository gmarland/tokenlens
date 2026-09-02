import { NextResponse } from "next/server";
import { updateUserProfile } from "@tokenlens/database";
import { requireWorkspace } from "../../../lib/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function uniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; driverError?: { code?: unknown } };
  return candidate.code === "23505" || candidate.driverError?.code === "23505";
}

export async function PATCH(request: Request) {
  const access = await requireWorkspace();
  const body = await request.json().catch(() => ({})) as {
    name?: unknown;
    email?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!name || name.length > 100) {
    return NextResponse.json(
      { error: "Name is required and must be 100 characters or fewer." },
      { status: 400 },
    );
  }
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const profile = await updateUserProfile(access.userId, { name, email });
    return profile
      ? NextResponse.json(profile)
      : NextResponse.json({ error: "User not found." }, { status: 404 });
  } catch (error) {
    if (uniqueViolation(error)) {
      return NextResponse.json(
        { error: "That email address is already in use." },
        { status: 409 },
      );
    }
    throw error;
  }
}
