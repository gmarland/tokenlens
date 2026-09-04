"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Panel } from "../../components/ui";
import { useToast } from "../../components/toast-provider";

type Profile = {
  name: string;
  email: string;
};

export default function ProfileClient({ initial }: { initial: Profile }) {
  const router = useRouter();
  const showToast = useToast();
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);
  const normalized = { name: name.trim(), email: email.trim().toLowerCase() };
  const dirty = normalized.name !== saved.name || normalized.email !== saved.email;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const result = await response.json();
      if (!response.ok) {
        showToast(result.error ?? "Could not update your profile.", "error");
        return;
      }
      const profile = { name: String(result.name), email: String(result.email) };
      setName(profile.name);
      setEmail(profile.email);
      setSaved(profile);
      showToast("Profile updated.", "success");
      router.refresh();
    } catch {
      showToast("Could not update your profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  return <Panel sx={{ maxWidth: 680 }}>
    <Typography variant="h2">Personal details</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
      Your email address is used for future magic-link sign-ins.
    </Typography>
    <Box component="form" onSubmit={saveProfile} sx={{ display: "grid", gap: 2.5 }}>
      <TextField
        name="name"
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        autoComplete="name"
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <TextField
        name="email"
        type="email"
        label="Email address"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        autoComplete="email"
        slotProps={{ htmlInput: { maxLength: 254 } }}
      />
      <Box>
        <Button type="submit" variant="contained" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </Box>
    </Box>
  </Panel>;
}
