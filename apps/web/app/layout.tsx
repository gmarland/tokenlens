import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import MuiLink from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import Link from "../components/link";
import AccountMenu from "../components/account-menu";
import theme from "./theme";
import { auth, signOut } from "../auth";

export const metadata = {
  title: "TokenLens — Codebase efficiency profiler",
  description:
    "Observed relationships between repository structure and coding-agent context consumption",
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const workspaceRole = (session?.user as { workspaceRole?: "owner" | "member" } | undefined)?.workspaceRole;
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
              <Toolbar
                sx={{
                  minHeight: "72px !important",
                  width: "100%",
                  maxWidth: 1440,
                  mx: "auto",
                  px: { xs: 2.5, sm: 4, md: 8 },
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                }}
              >
                <MuiLink
                  component={Link}
                  href="/"
                  color="inherit"
                  underline="none"
                >
                  <Typography
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1.25,
                      fontSize: 18,
                      fontWeight: 800,
                      letterSpacing: "-.035em",
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 10,
                        height: 10,
                        bgcolor: "secondary.main",
                        border: "1px solid",
                        borderColor: "primary.main",
                      }}
                    />
                    TokenLens
                  </Typography>
                </MuiLink>
                <Box
                  component="nav"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: { xs: 2, sm: 2.5, md: 5 },
                    justifySelf: "end",
                  }}
                >
                  <MuiLink
                    component={Link}
                    href="/"
                    color="inherit"
                    underline="hover"
                    sx={{ display: { xs: "none", sm: "inline" }, fontSize: 13, fontWeight: 800 }}
                  >
                    Repositories
                  </MuiLink>
                  {workspaceRole === "owner" ? (
                    <MuiLink
                      component={Link}
                      href="/members"
                      color="inherit"
                      underline="hover"
                      sx={{ display: { xs: "none", sm: "inline" }, fontSize: 13, fontWeight: 800 }}
                    >
                      Members
                    </MuiLink>
                  ) : null}
                  {session?.user ? (
                    <>
                      {workspaceRole === "owner" ? (
                        <MuiLink component={Link} href="/api-keys" color="inherit" underline="hover" sx={{ fontSize: 13, fontWeight: 800 }}>
                          API Keys
                        </MuiLink>
                      ) : null}
                      <AccountMenu signOutAction={async () => { "use server"; await signOut({ redirectTo: "/login" }); }} />
                    </>
                  ) : null}
                </Box>
              </Toolbar>
            </AppBar>
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
