import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { SwRegister } from "./sw-register";
import type { ReactNode } from "react";

export const metadata = {
  title: "ERP Admin",
  description: "Admin console",
  manifest: "/manifest.json",
  themeColor: "#111111",
  icons: {
    icon: "/icons/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider target="admin" />
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
