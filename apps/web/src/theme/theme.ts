import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#1D4ED8" },
    secondary: { main: "#475569" },
    background: { default: "#F8FAFC", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#64748B" },
    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", sans-serif',
    h1: {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontWeight: 600,
      fontSize: "1.5rem",
    },
    h2: {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontWeight: 600,
      fontSize: "1.25rem",
    },
    h3: {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontWeight: 600,
      fontSize: "2rem",
    },
    h6: {
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontWeight: 500,
      fontSize: "1.125rem",
    },
    body1: { fontSize: "1rem" },
    body2: { fontSize: "0.875rem" },
    button: { fontSize: "0.875rem", textTransform: "none" },
    caption: { fontSize: "0.75rem" },
  },
});
