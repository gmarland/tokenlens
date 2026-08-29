import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { Cards, Eyebrow, Page } from "../components/ui";

export default function Loading() {
  return <Page><Eyebrow>Loading telemetry</Eyebrow><Typography variant="h1">Preparing analytics…</Typography>
    <Cards>{[1, 2, 3, 4].map((x) => <Skeleton key={x} variant="rounded" height={92} />)}</Cards>
  </Page>;
}
