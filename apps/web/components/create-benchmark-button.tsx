"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./toast-provider";

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
  const showToast = useToast();
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
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
      showToast(reason instanceof Error ? reason.message : "Could not create benchmark", "error");
      setPending(false);
    }
  }

  return <Stack spacing={1.5} sx={{ alignItems: "flex-start", mt: 3 }}>
    <Button disabled={pending} onClick={create} variant="contained">
      {pending ? "Creating…" : "Benchmark this prompt"}
    </Button>
  </Stack>;
}
