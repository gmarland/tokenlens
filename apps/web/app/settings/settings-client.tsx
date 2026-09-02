"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

type Row = Record<string, any>;

export default function SettingsClient({ initial, endpoint }: { initial: { keys: Row[]; agents: Row[] }; endpoint: string }) {
  const [data, setData] = useState(initial);
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () => location.reload();
  async function createKey(form: FormData) {
    const response = await fetch("/api/workspace/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name") }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error);
    setSecret(result.secret);
    setData((current) => ({ ...current, keys: [result, ...current.keys] }));
  }
  async function remove(route: string, id: string) {
    const response = await fetch(route, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error);
    refresh();
  }
  return <Box sx={{ display: "grid", gap: 4 }}>
    {message ? <Alert severity="info">{message}</Alert> : null}
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>API keys</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Keys can write telemetry but cannot read dashboard data.</Typography>
      {secret ? <Alert severity="warning" sx={{ mb: 2 }}>Copy this key now; it will not be shown again.<Box component="code" sx={{ display: "block", mt: 1, overflowWrap: "anywhere" }}>{secret}</Box><Box component="code" sx={{ display: "block", mt: 1 }}>repo-profiler install --provider all --endpoint {endpoint} --key {secret}</Box></Alert> : null}
      <Box component="form" action={createKey} sx={{ display: "flex", gap: 1, mb: 2 }}><TextField name="name" label="Key name" size="small" defaultValue="CLI key" /><Button type="submit" variant="contained">Create key</Button></Box>
      {data.keys.map((key) => <Box key={key.id} sx={{ display: "flex", gap: 2, alignItems: "center", py: 1 }}><Box sx={{ flex: 1 }}><strong>{key.name}</strong> · <code>{key.key_prefix}</code>{key.revoked_at ? " · revoked" : ""}</Box>{!key.revoked_at ? <Button color="error" onClick={() => remove("/api/workspace/keys", key.id)}>Revoke</Button> : null}</Box>)}
    </Box>
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>CLI installations</Typography>
      {data.agents.length ? data.agents.map((agent) => <Box key={agent.id} sx={{ display: "flex", gap: 2, alignItems: "center", py: 1 }}><Box sx={{ flex: 1 }}><strong>{agent.name}</strong> · {(agent.providers ?? []).join(", ") || "legacy"}{agent.revoked_at ? " · revoked" : ""}</Box>{!agent.revoked_at ? <Button color="error" onClick={() => remove("/api/workspace/agents", agent.id)}>Revoke</Button> : null}</Box>) : <Typography color="text.secondary">No registered installations yet.</Typography>}
    </Box>
  </Box>;
}
