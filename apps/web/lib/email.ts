export async function sendWorkspaceInvitation(input: {
  email: string;
  workspaceName: string;
  inviterEmail: string;
}) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) return false;
  const origin = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const login = new URL("/login", origin);
  login.searchParams.set("email", input.email);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "TokenLens <onboarding@resend.dev>",
      to: input.email,
      subject: `Join ${input.workspaceName} on TokenLens`,
      text: `${input.inviterEmail} invited you to ${input.workspaceName} on TokenLens. Sign in with this email address to accept: ${login}`,
      html: `<p>${input.inviterEmail} invited you to <strong>${input.workspaceName}</strong> on TokenLens.</p><p><a href="${login}">Sign in with this email address to accept</a></p>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${details}`);
  }

  return true;
}
