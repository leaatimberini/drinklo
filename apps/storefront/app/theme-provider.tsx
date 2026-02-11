"use client";

import { useEffect } from "react";

type ThemeTokens = {
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
    muted: string;
  };
  typography: {
    fontFamily: string;
    headingFamily: string;
  };
  radii: {
    sm: string;
    md: string;
    lg: string;
  };
  components: {
    buttonBg: string;
    buttonText: string;
    cardBg: string;
    cardBorder: string;
  };
};

type ThemeResponse = {
  storefront: ThemeTokens;
  admin: ThemeTokens;
};

export function ThemeProvider() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  useEffect(() => {
    fetch(`${apiUrl}/themes/public`)
      .then((res) => res.json())
      .then((data: ThemeResponse) => {
        const theme = data.storefront;
        const root = document.documentElement.style;
        root.setProperty("--color-bg", theme.colors.background);
        root.setProperty("--color-fg", theme.colors.foreground);
        root.setProperty("--color-primary", theme.colors.primary);
        root.setProperty("--color-secondary", theme.colors.secondary);
        root.setProperty("--color-accent", theme.colors.accent);
        root.setProperty("--color-muted", theme.colors.muted);
        root.setProperty("--font-body", theme.typography.fontFamily);
        root.setProperty("--font-heading", theme.typography.headingFamily);
        root.setProperty("--radius-sm", theme.radii.sm);
        root.setProperty("--radius-md", theme.radii.md);
        root.setProperty("--radius-lg", theme.radii.lg);
        root.setProperty("--button-bg", theme.components.buttonBg);
        root.setProperty("--button-text", theme.components.buttonText);
        root.setProperty("--card-bg", theme.components.cardBg);
        root.setProperty("--card-border", theme.components.cardBorder);
      })
      .catch(() => undefined);
  }, [apiUrl]);

  return null;
}
