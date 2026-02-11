export type ThemeId = "A" | "B" | "C";

export type ThemeTokens = {
  id: ThemeId;
  name: string;
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

export const ThemeTemplates: Record<ThemeId, ThemeTokens> = {
  A: {
    id: "A",
    name: "Classic",
    colors: {
      background: "#f7f7f2",
      foreground: "#1b1b1b",
      primary: "#1f6feb",
      secondary: "#0f766e",
      accent: "#f97316",
      muted: "#e5e7eb",
    },
    typography: {
      fontFamily: "'Work Sans', ui-sans-serif, system-ui",
      headingFamily: "'DM Serif Display', ui-serif, serif",
    },
    radii: {
      sm: "6px",
      md: "10px",
      lg: "16px",
    },
    components: {
      buttonBg: "#1f6feb",
      buttonText: "#ffffff",
      cardBg: "#ffffff",
      cardBorder: "#e5e7eb",
    },
  },
  B: {
    id: "B",
    name: "Studio",
    colors: {
      background: "#0b1220",
      foreground: "#f8fafc",
      primary: "#22c55e",
      secondary: "#38bdf8",
      accent: "#eab308",
      muted: "#1e293b",
    },
    typography: {
      fontFamily: "'Space Grotesk', ui-sans-serif, system-ui",
      headingFamily: "'Space Grotesk', ui-sans-serif, system-ui",
    },
    radii: {
      sm: "8px",
      md: "14px",
      lg: "22px",
    },
    components: {
      buttonBg: "#22c55e",
      buttonText: "#0b1220",
      cardBg: "#111827",
      cardBorder: "#1e293b",
    },
  },
  C: {
    id: "C",
    name: "Warm",
    colors: {
      background: "#fff7ed",
      foreground: "#3f2d1f",
      primary: "#c2410c",
      secondary: "#a16207",
      accent: "#db2777",
      muted: "#fde68a",
    },
    typography: {
      fontFamily: "'Cabinet Grotesk', ui-sans-serif, system-ui",
      headingFamily: "'Playfair Display', ui-serif, serif",
    },
    radii: {
      sm: "4px",
      md: "12px",
      lg: "20px",
    },
    components: {
      buttonBg: "#c2410c",
      buttonText: "#fff7ed",
      cardBg: "#ffffff",
      cardBorder: "#fcd34d",
    },
  },
};
