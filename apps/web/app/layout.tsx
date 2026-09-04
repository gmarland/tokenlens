import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import MuiLink from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import Link from "../components/link";
import AccountMenu from "../components/account-menu";
import { ToastProvider } from "../components/toast-provider";
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
                  href={session?.user ? "/dashboard" : "/"}
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
                  {session?.user ? (
                    <>
                      <MuiLink
                        component={Link}
                        href="/dashboard"
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
                      {workspaceRole === "owner" ? (
                        <MuiLink component={Link} href="/api-keys" color="inherit" underline="hover" sx={{ fontSize: 13, fontWeight: 800 }}>
                          API Keys
                        </MuiLink>
                      ) : null}
                      <AccountMenu signOutAction={async () => { "use server"; await signOut({ redirectTo: "/login" }); }} />
                    </>
                  ) : (
                    <>
                      <MuiLink component="a" href="/#product" color="inherit" underline="hover" sx={{ display: { xs: "none", md: "inline" }, fontSize: 13, fontWeight: 800 }}>
                        Product
                      </MuiLink>
                      <MuiLink component="a" href="/#how" color="inherit" underline="hover" sx={{ display: { xs: "none", md: "inline" }, fontSize: 13, fontWeight: 800 }}>
                        How it works
                      </MuiLink>
                      <MuiLink component="a" href="/#privacy" color="inherit" underline="hover" sx={{ display: { xs: "none", md: "inline" }, fontSize: 13, fontWeight: 800 }}>
                        Privacy
                      </MuiLink>
                      <MuiLink component={Link} href="/login" color="inherit" underline="hover" sx={{ display: { xs: "none", sm: "inline" }, fontSize: 13, fontWeight: 800 }}>
                        Sign in
                      </MuiLink>
                      <Button component={Link} href="/login" variant="contained" size="small">
                        Start measuring
                      </Button>
                    </>
                  )}
                </Box>
              </Toolbar>
            </AppBar>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
