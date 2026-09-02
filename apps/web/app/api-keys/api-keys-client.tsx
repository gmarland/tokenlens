"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { EmptyState, Label, Panel } from "../../components/ui";
import { formatLocalTimestamp } from "../../lib/date-time";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type AgentInstallation = {
  id: string;
  name: string;
  providers: string[] | null;
  cli_version: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

type ManagementData = {
  keys: ApiKey[];
  agents: AgentInstallation[];
};

type Notice = {
  severity: "success" | "error";
  text: string;
};

type RevocationTarget = {
  type: "key" | "installation";
  id: string;
  name: string;
};

type CreatedKeyDetails = {
  name: string;
  secret: string;
  installCommand: string;
};

function MetadataItem({ label, children }: { label: string; children: ReactNode }) {
  return <Box>
    <Label>{label}</Label>
    <Typography sx={{ mt: .5 }}>{children}</Typography>
  </Box>;
}

export default function ApiKeysClient({ initial, endpoint }: { initial: ManagementData; endpoint: string }) {
  const [data, setData] = useState(initial);
  const [createdKeyDetails, setCreatedKeyDetails] = useState<CreatedKeyDetails | null>(null);
  const [copied, setCopied] = useState({ secret: false, command: false });
  const [copyError, setCopyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revocationTarget, setRevocationTarget] = useState<RevocationTarget | null>(null);
  const activeKeyCount = data.keys.filter((key) => !key.revoked_at).length;

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setNotice(null);
    setCreatedKeyDetails(null);
    setCopied({ secret: false, command: false });
    setCopyError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/workspace/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice({ severity: "error", text: result.error ?? "Could not create API key." });
        return;
      }
      const { secret: createdSecret, ...createdKey } = result;
      setCreatedKeyDetails({
        name: createdKey.name,
        secret: createdSecret,
        installCommand: `repo-profiler install --provider all --endpoint ${endpoint} --key ${createdSecret}`,
      });
      setData((current) => ({
        ...current,
        keys: [{ ...createdKey, last_used_at: null, revoked_at: null }, ...current.keys],
      }));
    } catch {
      setNotice({ severity: "error", text: "Could not create API key." });
    } finally {
      setCreating(false);
    }
  }

  async function copy(value: string, target: "secret" | "command") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied((current) => ({ ...current, [target]: true }));
      setCopyError(null);
    } catch {
      setCopyError(`Could not copy the ${target === "secret" ? "secret" : "install command"}. Select and copy it manually.`);
    }
  }

  function closeCreatedKeyDialog() {
    setCreatedKeyDetails(null);
    setCopied({ secret: false, command: false });
    setCopyError(null);
  }

  async function revoke() {
    if (!revocationTarget) return;
    setRevoking(true);
    setNotice(null);
    const route = revocationTarget.type === "key"
      ? "/api/workspace/keys"
      : "/api/workspace/agents";
    try {
      const response = await fetch(route, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: revocationTarget.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice({ severity: "error", text: result.error ?? "Could not revoke access." });
        return;
      }
      const revokedAt = new Date().toISOString();
      setData((current) => revocationTarget.type === "key"
        ? { ...current, keys: current.keys.map((key) => key.id === revocationTarget.id ? { ...key, revoked_at: revokedAt } : key) }
        : { ...current, agents: current.agents.map((agent) => agent.id === revocationTarget.id ? { ...agent, revoked_at: revokedAt } : agent) });
      setNotice({ severity: "success", text: `${revocationTarget.name} revoked.` });
      setRevocationTarget(null);
    } catch {
      setNotice({ severity: "error", text: "Could not revoke access." });
    } finally {
      setRevoking(false);
    }
  }

  return <Box sx={{ display: "grid", gap: 4 }}>
    {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

    <Panel>
      <Typography variant="h2">Create an API key</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 700 }}>
        API keys can write telemetry to this workspace. They cannot read dashboard data or manage your workspace.
      </Typography>
      <Box component="form" onSubmit={createKey} sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField name="name" label="Key name" size="small" defaultValue="CLI key" required slotProps={{ htmlInput: { maxLength: 80 } }} sx={{ minWidth: { xs: "100%", sm: 280 } }} />
        <Button type="submit" variant="contained" disabled={creating}>{creating ? "Creating…" : "Create key"}</Button>
      </Box>
    </Panel>

    <Panel>
      <Typography variant="h2">Existing API keys</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Rotate keys periodically and revoke credentials that are no longer in use.
      </Typography>
      {data.keys.length ? <Box sx={{ borderTop: 1, borderColor: "divider" }}>
        {data.keys.map((key) => <Box key={key.id} sx={{ py: 2.5, borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }}>{key.name}</Typography>
              <Chip size="small" label={key.revoked_at ? "Revoked" : "Active"} color={key.revoked_at ? "default" : "info"} variant={key.revoked_at ? "outlined" : "filled"} />
            </Box>
            {!key.revoked_at ? <Button
              color="error"
              variant="outlined"
              disabled={activeKeyCount <= 1}
              title={activeKeyCount <= 1 ? "Create a replacement before revoking the last active key" : undefined}
              onClick={() => setRevocationTarget({ type: "key", id: key.id, name: key.name })}
            >Revoke</Button> : null}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2, mt: 2 }}>
            <MetadataItem label="Key prefix"><Box component="code">{key.key_prefix}</Box></MetadataItem>
            <MetadataItem label="Created">{formatLocalTimestamp(key.created_at, "compact")}</MetadataItem>
            <MetadataItem label="Last used">{key.last_used_at ? formatLocalTimestamp(key.last_used_at, "compact") : "Never"}</MetadataItem>
          </Box>
        </Box>)}
      </Box> : <EmptyState>No API keys have been created.</EmptyState>}
      {activeKeyCount <= 1 ? <Typography color="text.secondary" sx={{ mt: 2, fontSize: 13 }}>
        Create a replacement before revoking the last active key.
      </Typography> : null}
    </Panel>

    <Panel>
      <Typography variant="h2">Connected CLI installations</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3, maxWidth: 760 }}>
        Installations register when the CLI connects with an API key. Revoke an installation to stop that device without rotating its key.
      </Typography>
      {data.agents.length ? <Box sx={{ borderTop: 1, borderColor: "divider" }}>
        {data.agents.map((agent) => <Box key={agent.id} sx={{ py: 2.5, borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography sx={{ fontWeight: 800 }}>{agent.name}</Typography>
              <Chip size="small" label={agent.revoked_at ? "Revoked" : "Connected"} color={agent.revoked_at ? "default" : "info"} variant={agent.revoked_at ? "outlined" : "filled"} />
            </Box>
            {!agent.revoked_at ? <Button color="error" variant="outlined" onClick={() => setRevocationTarget({ type: "installation", id: agent.id, name: agent.name })}>Revoke</Button> : null}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2, mt: 2 }}>
            <MetadataItem label="Providers">{(agent.providers ?? []).join(", ") || "Legacy installation"}</MetadataItem>
            <MetadataItem label="CLI version">{agent.cli_version || "Unknown"}</MetadataItem>
            <MetadataItem label="Last seen">{agent.last_seen_at ? formatLocalTimestamp(agent.last_seen_at, "compact") : "Never"}</MetadataItem>
          </Box>
        </Box>)}
      </Box> : <EmptyState>No CLI installations have connected yet.</EmptyState>}
    </Panel>

    <Dialog
      open={Boolean(createdKeyDetails)}
      fullWidth
      maxWidth="md"
      onClose={(_, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
      }}
      slotProps={{
        paper: {
          sx: {
            m: { xs: 2, sm: 4 },
            maxHeight: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
            border: 1,
            borderColor: "primary.main",
            boxShadow: "-10px 10px 0 #d5d5cb",
            overflow: "hidden",
          },
        },
      }}
    >
      <Box sx={{ height: 9, bgcolor: "secondary.main", borderBottom: 1 }} />
      <DialogTitle component="div" sx={{ px: { xs: 2.5, sm: 4 }, pt: { xs: 2.5, sm: 4 }, pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="overline">Ready to use</Typography>
            <Typography variant="h2" sx={{ mt: .75 }}>API key created</Typography>
          </Box>
          <Chip label="One-time secret" color="info" />
        </Box>
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          <Box component="span" sx={{ color: "text.primary", fontWeight: 800 }}>{createdKeyDetails?.name}</Box> is active and ready to send telemetry.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2.5, sm: 4 }, pb: { xs: 2.5, sm: 4 } }}>
        <Box sx={{ bgcolor: "#ffffd9", border: 1, borderLeft: 6, borderLeftColor: "secondary.main", p: 2, mb: 3 }}>
          <Typography sx={{ fontWeight: 800 }}>Save this secret before continuing</Typography>
          <Typography sx={{ mt: .5 }}>For security, TokenLens cannot show it again after you close this dialog.</Typography>
        </Box>

        {copyError ? <Alert severity="error" sx={{ mb: 3 }}>{copyError}</Alert> : null}

        <Typography variant="overline">Secret key</Typography>
        <Box sx={{ mt: 1, bgcolor: "primary.main", color: "primary.contrastText", border: 1, borderColor: "primary.main", p: { xs: 2, sm: 2.5 } }}>
          <Box component="code" sx={{ display: "block", color: "secondary.main", fontSize: { xs: 13, sm: 15 }, lineHeight: 1.6, overflowWrap: "anywhere", userSelect: "all" }}>
            {createdKeyDetails?.secret}
          </Box>
          <Button
            autoFocus
            color="secondary"
            variant="contained"
            sx={{ mt: 2 }}
            onClick={() => createdKeyDetails && copy(createdKeyDetails.secret, "secret")}
          >
            {copied.secret ? "Secret copied" : "Copy secret"}
          </Button>
        </Box>

        <Typography variant="overline" sx={{ display: "block", mt: 3 }}>Install the CLI</Typography>
        <Typography color="text.secondary" sx={{ mt: .75, mb: 1.5 }}>
          Run this command to connect all supported providers with the new key.
        </Typography>
        <Box sx={{ bgcolor: "#f4f4ef", border: 1, p: { xs: 2, sm: 2.5 } }}>
          <Box component="code" sx={{ display: "block", fontSize: 13, lineHeight: 1.6, overflowWrap: "anywhere", userSelect: "all" }}>
            {createdKeyDetails?.installCommand}
          </Box>
          <Button
            variant="outlined"
            sx={{ mt: 2, bgcolor: "background.paper" }}
            onClick={() => createdKeyDetails && copy(createdKeyDetails.installCommand, "command")}
          >
            {copied.command ? "Command copied" : "Copy command"}
          </Button>
        </Box>
        <Box
          component="span"
          role="status"
          aria-live="polite"
          sx={{ position: "absolute", width: 1, height: 1, p: 0, m: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}
        >
          {copied.secret ? "Secret copied." : ""} {copied.command ? "Install command copied." : ""}
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: { xs: 2.5, sm: 4 }, py: 2.5 }}>
        <Typography color="text.secondary" sx={{ mr: "auto", fontSize: 13, display: { xs: "none", sm: "block" } }}>
          Closing clears the secret from this page.
        </Typography>
        <Button variant="contained" onClick={closeCreatedKeyDialog}>I’ve saved the key</Button>
      </DialogActions>
    </Dialog>

    <Dialog open={Boolean(revocationTarget)} onClose={revoking ? undefined : () => setRevocationTarget(null)}>
      <DialogTitle>Revoke {revocationTarget?.type === "key" ? "API key" : "CLI installation"}?</DialogTitle>
      <DialogContent>
        <Typography>
          {revocationTarget?.type === "key"
            ? `${revocationTarget.name} will immediately stop authenticating telemetry requests.`
            : `${revocationTarget?.name} will need to be installed again before it can send telemetry.`}
        </Typography>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={() => setRevocationTarget(null)} disabled={revoking}>Cancel</Button>
        <Button color="error" variant="contained" onClick={revoke} disabled={revoking}>{revoking ? "Revoking…" : "Revoke"}</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
