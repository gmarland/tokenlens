"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { WorkspaceAccessDataTable } from "../../components/data-tables";
import {
  workspaceAccessTableRows,
  type WorkspaceInvitation as Invitation,
  type WorkspaceMember as Member,
} from "../../components/workspace-access-data";
import { Panel } from "../../components/ui";
import { useToast } from "../../components/toast-provider";

type MembersData = {
  members: Member[];
  invitations: Invitation[];
};

type RemovalTarget = {
  type: "member" | "invitation";
  id: string;
  label: string;
};

type EditTarget = RemovalTarget & {
  role: "owner" | "member";
};

export default function MembersClient({ initial, currentUserId }: { initial: MembersData; currentUserId: string }) {
  const showToast = useToast();
  const [members, setMembers] = useState(initial.members);
  const [invitations, setInvitations] = useState(initial.invitations);
  const [inviting, setInviting] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editRole, setEditRole] = useState<"owner" | "member">("member");
  const [savingEdit, setSavingEdit] = useState(false);
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(null);
  const [removing, setRemoving] = useState(false);
  const managingAccess = savingEdit || removing;
  const accessRows = workspaceAccessTableRows(members, invitations, currentUserId);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setInviting(true);

    try {
      const response = await fetch("/api/workspace/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), role: form.get("role") }),
      });
      const result = await response.json();
      if (!response.ok) {
        showToast(result.error ?? "Could not create the invitation.", "error");
        return;
      }

      const invitation = result.invitation as Invitation;
      setInvitations((current) => [
        invitation,
        ...current.filter((item) => item.email.toLowerCase() !== invitation.email.toLowerCase()),
      ]);
      formElement.reset();
      showToast(
        result.emailSent
          ? `Invitation sent to ${invitation.email}.`
          : `Invitation created for ${invitation.email}; configure AUTH_RESEND_KEY to send email.`,
        result.emailSent ? "success" : "info",
      );
    } catch {
      showToast("Could not create the invitation.", "error");
    } finally {
      setInviting(false);
    }
  }

  function openEdit(target: EditTarget) {
    setEditTarget(target);
    setEditRole(target.role);
  }

  async function saveRole() {
    if (!editTarget) return;
    const target = editTarget;
    if (editRole === target.role) {
      setEditTarget(null);
      return;
    }
    setSavingEdit(true);
    try {
      const response = await fetch(target.type === "member" ? "/api/workspace/members" : "/api/workspace/invitations", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: target.id, role: editRole }),
      });
      const result = await response.json();
      if (!response.ok) {
        showToast(result.error ?? `Could not change the ${target.type}'s role.`, "error");
        return;
      }
      if (target.type === "member") {
        setMembers((current) => current.map((item) => item.id === target.id ? { ...item, role: result.role } : item));
      } else {
        setInvitations((current) => current.map((item) => item.id === target.id ? result : item));
      }
      setEditTarget(null);
      showToast(
        target.type === "member"
          ? `${target.label} is now ${editRole === "owner" ? "an owner" : "a member"}.`
          : `${target.label} will join as ${editRole === "owner" ? "an owner" : "a member"}.`,
        "success",
      );
    } catch {
      showToast(`Could not change the ${target.type}'s role.`, "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeAccess() {
    if (!removalTarget) return;
    const target = removalTarget;
    setRemoving(true);
    try {
      const response = await fetch(target.type === "member" ? "/api/workspace/members" : "/api/workspace/invitations", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: target.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        showToast(result.error ?? `Could not remove the ${target.type}.`, "error");
        return;
      }
      if (target.type === "member") {
        setMembers((current) => current.filter((member) => member.id !== target.id));
      } else {
        setInvitations((current) => current.filter((invitation) => invitation.id !== target.id));
      }
      setRemovalTarget(null);
      showToast(
        target.type === "member"
          ? `${target.label} was removed from the workspace.`
          : `The invitation for ${target.label} was cancelled.`,
        "success",
      );
    } catch {
      showToast(`Could not remove the ${target.type}.`, "error");
    } finally {
      setRemoving(false);
    }
  }

  return <Box sx={{ display: "grid", gap: 4 }}>
    <Box>
      <Typography variant="h5">Workspace access</Typography>
      <Typography color="text.secondary" sx={{ mt: .75 }}>
        Active members and people who have been invited to join this workspace.
      </Typography>
      <WorkspaceAccessDataTable
        rows={accessRows}
        disabled={managingAccess}
        onEdit={(row) => openEdit({
          type: row.type,
          id: row.entityId,
          label: row.displayName,
          role: row.role,
        })}
        onDelete={(row) => setRemovalTarget({
          type: row.type,
          id: row.entityId,
          label: row.displayName,
        })}
      />
    </Box>

    <Panel>
      <Typography variant="h5" sx={{ mb: 2 }}>Invite a member</Typography>
      <Box component="form" onSubmit={invite} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField name="email" type="email" label="Email" size="small" required disabled={inviting} />
        <TextField name="role" select size="small" defaultValue="member" disabled={inviting} sx={{ minWidth: 120 }}>
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="owner">Owner</MenuItem>
        </TextField>
        <Button type="submit" variant="outlined" disabled={inviting}>{inviting ? "Inviting…" : "Invite"}</Button>
      </Box>
    </Panel>

    <Dialog open={Boolean(editTarget)} onClose={savingEdit ? undefined : () => setEditTarget(null)} fullWidth maxWidth="xs">
      <DialogTitle>Edit {editTarget?.type === "invitation" ? "invitation" : "member"}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Change the workspace role for {editTarget?.label}.
        </Typography>
        <TextField
          autoFocus
          select
          fullWidth
          label="Role"
          value={editRole}
          disabled={savingEdit}
          onChange={(event) => setEditRole(event.target.value as "owner" | "member")}
        >
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="owner">Owner</MenuItem>
        </TextField>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={() => setEditTarget(null)} disabled={savingEdit}>Cancel</Button>
        <Button variant="contained" onClick={saveRole} disabled={savingEdit || editRole === editTarget?.role}>
          {savingEdit ? "Saving…" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>

    <Dialog open={Boolean(removalTarget)} onClose={removing ? undefined : () => setRemovalTarget(null)}>
      <DialogTitle>
        {removalTarget?.type === "invitation" ? "Cancel invitation" : "Remove member"} for {removalTarget?.label}?
      </DialogTitle>
      <DialogContent>
        <Typography>
          {removalTarget?.type === "invitation"
            ? "This person will no longer be able to use this invitation to join the workspace."
            : "This person will immediately lose access to this workspace. Their TokenLens account will not be deleted."}
        </Typography>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={() => setRemovalTarget(null)} disabled={removing}>Cancel</Button>
        <Button color="error" variant="contained" onClick={removeAccess} disabled={removing}>
          {removing ? "Removing…" : removalTarget?.type === "invitation" ? "Cancel invitation" : "Remove member"}
        </Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
