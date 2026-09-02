"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: "owner" | "member";
};

export default function MembersClient({ initialMembers }: { initialMembers: Member[] }) {
  const [message, setMessage] = useState<string | null>(null);

  async function invite(form: FormData) {
    const response = await fetch("/api/workspace/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), role: form.get("role") }),
    });
    const result = await response.json();
    setMessage(response.ok
      ? result.emailSent
        ? "Invitation sent."
        : "Invitation created; configure EMAIL_SERVER to send email."
      : result.error);
  }

  return <Box sx={{ display: "grid", gap: 4 }}>
    {message ? <Alert severity="info">{message}</Alert> : null}
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Workspace members</Typography>
      {initialMembers.map((member) => <Typography key={member.id} sx={{ py: .5 }}>{member.name || member.email} · {member.role}</Typography>)}
    </Box>
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Invite a member</Typography>
      <Box component="form" action={invite} sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <TextField name="email" type="email" label="Email" size="small" required />
        <TextField name="role" select size="small" defaultValue="member" sx={{ minWidth: 120 }}>
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="owner">Owner</MenuItem>
        </TextField>
        <Button type="submit" variant="outlined">Invite</Button>
      </Box>
    </Box>
  </Box>;
}
