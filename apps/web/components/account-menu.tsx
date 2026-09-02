"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Link from "./link";

export default function AccountMenu({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Box component="form" id="account-sign-out-form" action={signOutAction} />
      <IconButton
        aria-label="Open account menu"
        aria-controls={open ? "account-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="menu"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        size="small"
        sx={{
          width: 38,
          height: 38,
          borderRadius: 0,
          display: "inline-flex",
          flexDirection: "column",
          gap: "4px",
          "&:hover": { bgcolor: "secondary.main" },
        }}
      >
        {[0, 1, 2].map((line) => (
          <Box
            component="span"
            key={line}
            sx={{ width: 17, height: 2, bgcolor: "primary.main" }}
          />
        ))}
      </IconButton>
      <Menu
        id="account-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: { mt: 1, minWidth: 150, border: 1, borderColor: "primary.main" },
          },
        }}
      >
        <MenuItem component={Link} href="/profile" onClick={() => setAnchorEl(null)}>
          Profile
        </MenuItem>
        <MenuItem
          component="button"
          type="submit"
          form="account-sign-out-form"
          sx={{ width: "100%" }}
        >
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
