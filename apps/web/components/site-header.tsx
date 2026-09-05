import AppBar from "@mui/material/AppBar";
import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { signOut } from "../auth";
import AccountMenu from "./account-menu";
import Link from "./link";

function HeaderFrame({
  homeHref,
  children,
}: {
  homeHref: string;
  children: React.ReactNode;
}) {
  return (
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
          href={homeHref}
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
          aria-label="Primary navigation"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 2, sm: 2.5, md: 5 },
            justifySelf: "end",
          }}
        >
          {children}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function NavigationLink({
  href,
  children,
  display,
}: {
  href: string;
  children: React.ReactNode;
  display?: Record<string, string>;
}) {
  return (
    <MuiLink
      component={Link}
      href={href}
      color="inherit"
      underline="hover"
      sx={{ display, fontSize: 13, fontWeight: 800 }}
    >
      {children}
    </MuiLink>
  );
}

export function PublicHeader() {
  return (
    <HeaderFrame homeHref="/">
      <MuiLink component="a" href="/#product" color="inherit" underline="hover" sx={{ display: { xs: "none", md: "inline" }, fontSize: 13, fontWeight: 800 }}>
        Product
      </MuiLink>
      <MuiLink component="a" href="/#how" color="inherit" underline="hover" sx={{ display: { xs: "none", md: "inline" }, fontSize: 13, fontWeight: 800 }}>
        How it works
      </MuiLink>
      <MuiLink component="a" href="/#privacy" color="inherit" underline="hover" sx={{ display: { xs: "none", md: "inline" }, fontSize: 13, fontWeight: 800 }}>
        Privacy
      </MuiLink>
      <NavigationLink href="/login" display={{ xs: "none", sm: "inline" }}>
        Sign in
      </NavigationLink>
      <Button component={Link} href="/login" variant="contained" size="small">
        Start measuring
      </Button>
    </HeaderFrame>
  );
}

export function AuthenticatedHeader({
  workspaceRole,
}: {
  workspaceRole: "owner" | "member";
}) {
  return (
    <HeaderFrame homeHref="/dashboard">
      <NavigationLink href="/dashboard" display={{ xs: "none", sm: "inline" }}>
        Repositories
      </NavigationLink>
      {workspaceRole === "owner" ? (
        <NavigationLink href="/members" display={{ xs: "none", sm: "inline" }}>
          Members
        </NavigationLink>
      ) : null}
      {workspaceRole === "owner" ? (
        <NavigationLink href="/api-keys">API Keys</NavigationLink>
      ) : null}
      <AccountMenu
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
    </HeaderFrame>
  );
}
