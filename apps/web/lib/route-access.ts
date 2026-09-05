export type AccessDecision = "allow" | "dashboard" | "unauthorized";

export function accessDecision(path: string, authenticated: boolean): AccessDecision {
  const authPage = path === "/" || path === "/login";
  const publicRoute =
    authPage || path.startsWith("/login/") || path.startsWith("/api/auth/");
  if (authenticated) return authPage ? "dashboard" : "allow";
  return publicRoute ? "allow" : "unauthorized";
}
