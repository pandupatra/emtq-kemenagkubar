"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

const theme = createTheme({
  typography: {
    fontFamily: "var(--font-plus-jakarta-sans), Arial, sans-serif",
  },
  palette: { primary: { main: "#244c3a" } },
  shape: { borderRadius: 4 },
  components: {
    MuiTable: {
      styleOverrides: {
        root: {
          color: "var(--body)",
          "& caption": {
            captionSide: "top",
            color: "var(--body)",
            textAlign: "left",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: "var(--body)",
          borderColor: "var(--line)",
          fontFamily: "inherit",
          letterSpacing: "normal",
          verticalAlign: "top",
        },
        head: {
          color: "var(--muted)",
          backgroundColor: "var(--paper)",
          fontWeight: 600,
        },
        footer: { fontSize: "inherit" },
      },
    },
  },
});

export default function MuiProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
