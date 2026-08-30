"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect } from "react";
import { Page } from "../components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page>
      <Alert severity="error" variant="outlined">
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
          <div>
            <Typography variant="h6">Dashboard data could not be loaded</Typography>
            <Typography>
              Check the database connection, then try the request again.
            </Typography>
          </div>
          <Button variant="contained" onClick={reset}>Try again</Button>
        </Stack>
      </Alert>
    </Page>
  );
}
