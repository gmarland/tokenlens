import { NextResponse } from "next/server";
import { auth } from "./auth";
import { accessDecision } from "./lib/route-access";

export const proxy = auth((request) => {
  const path = request.nextUrl.pathname;
  const decision = accessDecision(path, Boolean(request.auth));
  if (decision === "dashboard") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (decision === "allow") return NextResponse.next();
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("callbackUrl", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
