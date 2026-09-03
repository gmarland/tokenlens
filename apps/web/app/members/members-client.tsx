"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { EmptyState } from "../../components/ui";
import { formatLocalTimestamp } from "../../lib/date-time";

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: "owner" | "member";
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: "owner" | "member";
  created_at: string;
  expires_at: string;
  status: "invited" | "expired";
};

type MembersData = {
  members: Member[];
  invitations: Invitation[];
};

type Notice = {
  severity: "success" | "error" | "info";
  text: string;
};

export default function MembersClient({ initial }: { initial: MembersData }) {
  const [invitations, setInvitations] = useState(initial.invitations);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [inviting, setInviting] = useState(false);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setInviting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/workspace/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), role: form.get("role") }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice({ severity: "error", text: result.error ?? "Could not create the invitation." });
        return;
      }

      const invitation = result.invitation as Invitation;
      setInvitations((current) => [
        invitation,
        ...current.filter((item) => item.email.toLowerCase() !== invitation.email.toLowerCase()),
      ]);
      formElement.reset();
      setNotice({
        severity: result.emailSent ? "success" : "info",
        text: result.emailSent
          ? `Invitation sent to ${invitation.email}.`
          : `Invitation created for ${invitation.email}; configure EMAIL_SERVER to send email.`,
      });
    } catch {
      setNotice({ severity: "error", text: "Could not create the invitation." });
    } finally {
      setInviting(false);
    }
  }

  return <Box sx={{ display: "grid", gap: 4 }}>
    {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

    <Box>
      <Typography variant="h5">Workspace access</Typography>
      <Typography color="text.secondary" sx={{ mt: .75, mb: 2 }}>
        Active members and people who have been invited to join this workspace.
      </Typography>
      <Box sx={{ borderTop: 1, borderColor: "divider" }}>
        {initial.members.map((member) => <Box
          key={`member-${member.id}`}
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 2, borderBottom: 1, borderColor: "divider", flexWrap: "wrap" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }}>{member.name || member.email}</Typography>
            {member.name ? <Typography color="text.secondary" sx={{ fontSize: 13 }}>{member.email}</Typography> : null}
            <Typography color="text.secondary" sx={{ mt: .5, fontSize: 13 }}>
              Joined {formatLocalTimestamp(member.created_at, "date")}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip size="small" label={member.role === "owner" ? "Owner" : "Member"} variant="outlined" />
            <Chip size="small" label="Active" color="info" />
          </Box>
        </Box>)}

        {invitations.map((invitation) => <Box
          key={`invitation-${invitation.id}`}
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 2, borderBottom: 1, borderColor: "divider", flexWrap: "wrap" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }}>{invitation.email}</Typography>
            <Typography color="text.secondary" sx={{ mt: .5, fontSize: 13 }}>
              Invited {formatLocalTimestamp(invitation.created_at, "date")} · {invitation.status === "expired" ? "Expired" : "Expires"} {formatLocalTimestamp(invitation.expires_at, "date")}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip size="small" label={invitation.role === "owner" ? "Owner" : "Member"} variant="outlined" />
            <Chip
              size="small"
              label={invitation.status === "expired" ? "Expired" : "Invited"}
              color={invitation.status === "expired" ? "default" : "warning"}
              variant={invitation.status === "expired" ? "outlined" : "filled"}
            />
          </Box>
        </Box>)}
      </Box>
      {!invitations.length ? <EmptyState>No outstanding invitations.</EmptyState> : null}
    </Box>

    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Invite a member</Typography>
      <Box component="form" onSubmit={invite} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField name="email" type="email" label="Email" size="small" required disabled={inviting} />
        <TextField name="role" select size="small" defaultValue="member" disabled={inviting} sx={{ minWidth: 120 }}>
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="owner">Owner</MenuItem>
        </TextField>
        <Button type="submit" variant="outlined" disabled={inviting}>{inviting ? "Inviting…" : "Invite"}</Button>
      </Box>
    </Box>
  </Box>;
}
