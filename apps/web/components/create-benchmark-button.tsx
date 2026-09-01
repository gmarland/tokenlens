"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateBenchmarkButton({
  repositoryId,
  promptId,
  model,
}: {
  repositoryId: string;
  promptId: string;
  model: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/repositories/${repositoryId}/benchmarks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourcePromptId: promptId, model }),
      });
      const body = await response.json() as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error ?? "Could not create benchmark");
      router.push(`/benchmarks/${body.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create benchmark");
      setPending(false);
    }
  }

  return <Stack spacing={1.5} sx={{ alignItems: "flex-start", mt: 3 }}>
    <Button disabled={pending} onClick={create} variant="contained">
      {pending ? "Creating…" : "Benchmark this prompt"}
    </Button>
    {error ? <Alert severity="error">{error}</Alert> : null}
  </Stack>;
}
