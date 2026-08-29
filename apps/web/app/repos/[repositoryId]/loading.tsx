import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { Eyebrow, Page, Panel } from "../../../components/ui";

export default function Loading() {
  return <Page><Eyebrow>Loading repository</Eyebrow><Typography variant="h1">Joining structure and behaviour…</Typography>
    <Panel><Skeleton variant="rounded" height={280} /></Panel>
  </Page>;
}
