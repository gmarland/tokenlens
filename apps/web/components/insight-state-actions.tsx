"use client";

import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import type { InsightState } from "@tokenlens/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function InsightStateActions({ repositoryId, insightId, current }: {
  repositoryId: string;
  insightId: string;
  current: InsightState;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const update = async (state: InsightState) => {
    setPending(true);
    try {
      const response = await fetch("/api/insight-state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryId, insightId, state }),
      });
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  };
  return <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: "wrap" }}>
    {(["acknowledged", "monitoring", "dismissed"] as InsightState[]).map((state) =>
      <Button key={state} disabled={pending || current === state} onClick={() => update(state)} size="small" variant={current === state ? "contained" : "text"}>
        {state === "acknowledged" ? "Acknowledge" : state === "monitoring" ? "Monitor" : "Dismiss"}
      </Button>)}
  </Stack>;
}
