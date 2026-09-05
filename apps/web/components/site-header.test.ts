import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth", () => ({ signOut: vi.fn() }));

import { AuthenticatedHeader, PublicHeader } from "./site-header";

describe("site header access variants", () => {
  it("shows acquisition links only in the public header", () => {
    const markup = renderToStaticMarkup(createElement(PublicHeader));
    expect(markup).toContain("Product");
    expect(markup).toContain("Sign in");
    expect(markup).toContain("Start measuring");
    expect(markup).not.toContain("Repositories");
    expect(markup).not.toContain("Sign out");
  });

  it("shows application links but not public calls to action when signed in", () => {
    const markup = renderToStaticMarkup(
      createElement(AuthenticatedHeader, { workspaceRole: "owner" }),
    );
    expect(markup).toContain("Repositories");
    expect(markup).toContain("Members");
    expect(markup).toContain("API Keys");
    expect(markup).toContain("Open account menu");
    expect(markup).not.toContain("Start measuring");
    expect(markup).not.toContain("How it works");
  });

  it("does not expose owner navigation to members", () => {
    const markup = renderToStaticMarkup(
      createElement(AuthenticatedHeader, { workspaceRole: "member" }),
    );
    expect(markup).toContain("Repositories");
    expect(markup).not.toContain("Members");
    expect(markup).not.toContain("API Keys");
  });
});
