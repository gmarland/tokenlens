"use client";

import { createTheme } from "@mui/material/styles";

const black = "#000000";
const yellow = "#ffff00";
const blue = "#0696d7";
const warmSlate = "#d5d5cb";
const line = "#d7d7d0";

const theme = createTheme({
  palette: {
    background: { default: "#ffffff", paper: "#ffffff" },
    divider: line,
    primary: { main: black, contrastText: "#ffffff" },
    secondary: { main: yellow, contrastText: black },
    info: { main: blue, contrastText: "#ffffff" },
    warning: { main: yellow, contrastText: black },
    text: { primary: black, secondary: "#565656" },
  },
  shape: { borderRadius: 0 },
  spacing: 8,
  typography: {
    fontFamily: 'Arial, Helvetica, "Liberation Sans", sans-serif',
    fontSize: 14,
    h1: {
      fontSize: "clamp(2.1rem, 3.375vw, 3.29rem)",
      fontWeight: 800,
      lineHeight: 0.9,
      letterSpacing: "-0.067em",
    },
    h2: {
      fontSize: "clamp(1.5rem, 2.25vw, 2rem)",
      fontWeight: 800,
      lineHeight: 0.94,
      letterSpacing: "-0.055em",
    },
    h3: {
      fontWeight: 800,
      lineHeight: 1,
      letterSpacing: "-0.04em",
    },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 800 },
    button: {
      fontSize: "0.8125rem",
      fontWeight: 800,
      letterSpacing: "-0.01em",
      textTransform: "none",
    },
    overline: {
      fontSize: "0.6875rem",
      fontWeight: 800,
      lineHeight: 1.25,
      letterSpacing: "0.14em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { scrollBehavior: "smooth" },
        body: { textRendering: "optimizeLegibility" },
        "::selection": { backgroundColor: yellow, color: black },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,.96)",
          backgroundImage: "none",
          color: black,
          backdropFilter: "blur(12px)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 42,
          paddingInline: 17,
          borderWidth: 1,
          transition: "background-color 160ms ease, color 160ms ease, transform 160ms ease",
          "&:hover": { transform: "translate(-2px, -2px)" },
        },
        outlined: {
          borderColor: black,
          color: black,
          "&:hover": { borderColor: black, backgroundColor: yellow },
        },
      },
      variants: [
        {
          props: { variant: "contained", color: "primary" },
          style: { "&:hover": { backgroundColor: yellow, color: black } },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: { borderColor: black, boxShadow: "none" },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: black },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          textDecorationThickness: "2px",
          textUnderlineOffset: "5px",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { height: 28, fontWeight: 800 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: black },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: blue },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 2, borderColor: blue },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderColor: black },
      },
      variants: [
        {
          props: { variant: "outlined", severity: "warning" },
          style: { backgroundColor: "#ffffd9", color: black },
        },
      ],
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: warmSlate } },
    },
  },
});

export default theme;
