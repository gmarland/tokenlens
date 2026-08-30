import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
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
              sx={{ borderBottom: 1, borderColor: "primary.main" }}
            >
              <Toolbar sx={{ minHeight: "72px !important", width: "100%", maxWidth: 1440, mx: "auto", px: { xs: 2.5, sm: 4, md: 8 }, display: "grid", gridTemplateColumns: { xs: "1fr auto", sm: "1fr auto 1fr" } }}>
                <MuiLink component={Link} href="/" color="inherit" underline="none">
                  <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, fontSize: 18, fontWeight: 800, letterSpacing: "-.035em" }}>
                    <Box component="span" sx={{ width: 10, height: 10, bgcolor: "secondary.main", border: "1px solid", borderColor: "primary.main" }} />
                    TokenLens
                  </Typography>
                </MuiLink>
                <Box component="nav" sx={{ display: { xs: "none", sm: "flex" }, gap: { sm: 2.5, md: 5 }, justifySelf: "center" }}>
                  <MuiLink component={Link} href="/" color="inherit" underline="hover" sx={{ fontSize: 13, fontWeight: 800 }}>Repositories</MuiLink>
                  <MuiLink component={Link} href="/#methodology" color="inherit" underline="hover" sx={{ fontSize: 13, fontWeight: 800 }}>Methodology</MuiLink>
                </Box>
                <Typography sx={{ justifySelf: "end", bgcolor: "primary.main", color: "primary.contrastText", px: 1.5, py: 0.75, fontSize: 11, fontWeight: 800 }}>Codebase profiler</Typography>
              </Toolbar>
            </AppBar>
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
