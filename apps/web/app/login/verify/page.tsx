import Typography from "@mui/material/Typography";
import { Page, Panel } from "../../../components/ui";

export default function VerifyLogin() {
  return <Page><Panel sx={{ maxWidth: 560, mx: "auto", mt: 8, p: 4 }}>
    <Typography variant="h1">Check your email</Typography>
    <Typography sx={{ mt: 2 }}>Use the sign-in link we sent you. You can close this tab afterward.</Typography>
  </Panel></Page>;
}
