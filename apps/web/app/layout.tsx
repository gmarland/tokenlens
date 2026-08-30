import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CssBaseline from "@mui/material/CssBaseline";
import MuiLink from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import Link from "../components/link";
import theme from "./theme";

export const metadata = {
  title: "TokenLens — Codebase efficiency profiler",
  description:
    "Observed relationships between repository structure and coding-agent context consumption",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppBar
              component="header"
              position="sticky"
              color="default"
              elevation={0}
              sx={{ borderBottom: 1, borderColor: "divider" }}
            >
              <Toolbar sx={{ minHeight: "68px !important", width: "100%", maxWidth: 1240, mx: "auto", px: 3 }}>
                <MuiLink component={Link} href="/" color="inherit" underline="none">
                  <Typography sx={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, letterSpacing: "-.4px" }}>
                    <Box component="span" color="primary.main">Token</Box>Lens
                  </Typography>
                </MuiLink>
                <Box component="nav" sx={{ display: { xs: "none", sm: "flex" }, gap: 2.75, ml: "auto", mr: 3 }}>
                  <MuiLink component={Link} href="/" color="text.secondary" underline="hover">Repositories</MuiLink>
                  <MuiLink component={Link} href="/#methodology" color="text.secondary" underline="hover">Methodology</MuiLink>
                </Box>
                <Chip
                  size="small"
                  label="Prompt capture: ON"
                  sx={{ bgcolor: "text.primary", color: "common.white", fontSize: 11 }}
                />
              </Toolbar>
            </AppBar>
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
