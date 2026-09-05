import { describe, expect, it } from "vitest";
import { accessDecision } from "./lib/route-access";

describe("authentication route boundary", () => {
  it("allows only public routes without a session", () => {
    expect(accessDecision("/", false)).toBe("allow");
    expect(accessDecision("/login", false)).toBe("allow");
    expect(accessDecision("/login/verify", false)).toBe("allow");
    expect(accessDecision("/api/auth/session", false)).toBe("allow");
    expect(accessDecision("/dashboard", false)).toBe("unauthorized");
    expect(accessDecision("/repos/repository-1", false)).toBe("unauthorized");
    expect(accessDecision("/api/repositories", false)).toBe("unauthorized");
  });

  it("keeps authenticated users in the application area", () => {
    expect(accessDecision("/", true)).toBe("dashboard");
    expect(accessDecision("/login", true)).toBe("dashboard");
    expect(accessDecision("/dashboard", true)).toBe("allow");
    expect(accessDecision("/profile", true)).toBe("allow");
  });
});
