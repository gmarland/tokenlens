import nodemailer from "nodemailer";

export async function sendWorkspaceInvitation(input: {
  email: string;
  workspaceName: string;
  inviterEmail: string;
}) {
  const server = process.env.EMAIL_SERVER;
  if (!server) return false;
  const origin = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const login = new URL("/login", origin);
  login.searchParams.set("email", input.email);
  const transport = nodemailer.createTransport(server);
  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? "TokenLens <tokenlens@localhost>",
    to: input.email,
    subject: `Join ${input.workspaceName} on TokenLens`,
    text: `${input.inviterEmail} invited you to ${input.workspaceName} on TokenLens. Sign in with this email address to accept: ${login}`,
    html: `<p>${input.inviterEmail} invited you to <strong>${input.workspaceName}</strong> on TokenLens.</p><p><a href="${login}">Sign in with this email address to accept</a></p>`,
  });
  return true;
}
