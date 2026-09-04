import { NextResponse } from "next/server";
import { auth } from "./auth";

export const proxy = auth((request) => {
  const path = request.nextUrl.pathname;
  const publicRoute =
    path === "/" || path.startsWith("/login") || path.startsWith("/api/auth");
  if (publicRoute || request.auth) return NextResponse.next();
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
