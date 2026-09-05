import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { signIn } from "../../auth";
import { Page, Panel } from "../../components/ui";
import { ToastOnMount } from "../../components/toast-provider";
import { currentWorkspace } from "../../lib/auth";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    email?: string;
  }>;
}) {
  if (await currentWorkspace()) redirect("/dashboard");
  const query = await searchParams;
  const callbackUrl = query.callbackUrl?.startsWith("/")
    ? query.callbackUrl
    : "/dashboard";
  return (
    <Page>
      <Panel sx={{ maxWidth: 480, mx: "auto", mt: 8, p: 4 }}>
        <Typography variant="h1" sx={{ mb: 1 }}>
          Sign in to TokenLens
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          We’ll email you a secure sign-in link.
        </Typography>
        {query.error ? <ToastOnMount message="The sign-in link could not be sent or used." severity="error" /> : null}
        <Box
          component="form"
          action={async (formData: FormData) => {
            "use server";
            await signIn("resend", {
              email: String(formData.get("email") ?? "")
                .trim()
                .toLowerCase(),
              redirectTo: callbackUrl,
            });
          }}
          sx={{ display: "grid", gap: 2 }}
        >
          <TextField
            name="email"
            type="email"
            label="Email address"
            required
            autoComplete="email"
            defaultValue={query.email ?? ""}
          />
          <Button type="submit" variant="contained" size="large">
            Email me a sign-in link
          </Button>
        </Box>
        {process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? (
          <Box
            component="form"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
            sx={{ mt: 2 }}
          >
            <Button type="submit" variant="outlined" fullWidth>
              Continue with Google
            </Button>
          </Box>
        ) : null}
      </Panel>
    </Page>
  );
}
