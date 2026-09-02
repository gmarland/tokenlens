import type { Metadata } from "next";
import Typography from "@mui/material/Typography";
import { Page } from "../../components/ui";
import { requireWorkspace } from "../../lib/auth";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile — TokenLens",
};

export default async function ProfilePage() {
  const access = await requireWorkspace();
  return <Page>
    <Typography variant="h1">Profile</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
      Manage the personal details associated with your TokenLens account.
    </Typography>
    <ProfileClient initial={{ name: access.name, email: access.email }} />
  </Page>;
}
