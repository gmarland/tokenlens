import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWorkspaceInvitation } from "./email";

const invitation = {
  email: "ada@example.com",
  workspaceName: "Analytical Engines",
  inviterEmail: "owner@example.com",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendWorkspaceInvitation", () => {
  it("does not attempt delivery without a Resend API key", async () => {
    vi.stubEnv("AUTH_RESEND_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWorkspaceInvitation(invitation)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the invitation through the Resend Emails API", async () => {
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "TokenLens <login@updates.example.com>");
    vi.stubEnv("AUTH_URL", "https://tokenlens.example.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWorkspaceInvitation(invitation)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options).toMatchObject({
      method: "POST",
      headers: {
        authorization: "Bearer re_test_key",
        "content-type": "application/json",
      },
    });
    expect(JSON.parse(String(options.body))).toEqual({
      from: "TokenLens <login@updates.example.com>",
      to: "ada@example.com",
      subject: "Join Analytical Engines on TokenLens",
      text: "owner@example.com invited you to Analytical Engines on TokenLens. Sign in with this email address to accept: https://tokenlens.example.com/login?email=ada%40example.com",
      html: '<p>owner@example.com invited you to <strong>Analytical Engines</strong> on TokenLens.</p><p><a href="https://tokenlens.example.com/login?email=ada%40example.com">Sign in with this email address to accept</a></p>',
    });
  });

  it("throws when Resend rejects the message", async () => {
    vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"message":"Domain is not verified"}', {
          status: 403,
        }),
      ),
    );

    await expect(sendWorkspaceInvitation(invitation)).rejects.toThrow(
      'Resend email failed (403): {"message":"Domain is not verified"}',
    );
  });
});
