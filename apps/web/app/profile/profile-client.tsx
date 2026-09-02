"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Panel } from "../../components/ui";

type Profile = {
  name: string;
  email: string;
};

type Notice = {
  severity: "success" | "error";
  text: string;
};

export default function ProfileClient({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const normalized = { name: name.trim(), email: email.trim().toLowerCase() };
  const dirty = normalized.name !== saved.name || normalized.email !== saved.email;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice({ severity: "error", text: result.error ?? "Could not update your profile." });
        return;
      }
      const profile = { name: String(result.name), email: String(result.email) };
      setName(profile.name);
      setEmail(profile.email);
      setSaved(profile);
      setNotice({ severity: "success", text: "Profile updated." });
      router.refresh();
    } catch {
      setNotice({ severity: "error", text: "Could not update your profile." });
    } finally {
      setSaving(false);
    }
  }

  return <Panel sx={{ maxWidth: 680 }}>
    <Typography variant="h2">Personal details</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
      Your email address is used for future magic-link sign-ins.
    </Typography>
    {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ mb: 3 }}>{notice.text}</Alert> : null}
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
