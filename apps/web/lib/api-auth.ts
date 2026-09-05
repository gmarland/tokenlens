import { NextResponse } from "next/server";
import { currentWorkspace } from "./auth";

type WorkspaceAccess = NonNullable<Awaited<ReturnType<typeof currentWorkspace>>>;

export type ApiAuthorization =
  | { ok: true; access: WorkspaceAccess }
  | { ok: false; response: NextResponse };

export async function authorizeApi(
  requiredRole?: "owner",
): Promise<ApiAuthorization> {
  const access = await currentWorkspace();
  if (!access) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  if (requiredRole === "owner" && access.role !== "owner") {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, access };
}
