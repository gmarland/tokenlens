"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    background: { default: "#f6f8f5", paper: "#ffffff" },
    divider: "#dce5df",
    primary: { main: "#176b45", contrastText: "#ffffff" },
    secondary: { main: "#d88622" },
    text: { primary: "#17221c", secondary: "#647068" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
    h1: {
      fontFamily: "Georgia, serif",
      fontSize: "2.375rem",
      fontWeight: 500,
      lineHeight: 1.12,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontFamily: "Georgia, serif",
      fontSize: "1.5rem",
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: {
      styleOverrides: {
        root: { borderColor: "#dce5df", boxShadow: "0 1px 0 #e8eee9" },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#647068",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".06em",
          textTransform: "uppercase",
        },
      },
    },
  },
});

export default theme;
