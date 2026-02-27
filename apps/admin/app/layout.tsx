import "./globals.css";
import type { ReactNode } from "react";
import { ClientShell } from "./client-shell";

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
  const devtoolsEnabled =
    process.env.ADMIN_DEVTOOLS === "1" || process.env.NEXT_PUBLIC_ADMIN_DEVTOOLS === "1";

  return (
    <html lang="en">
      <body>
        <ClientShell devtoolsEnabled={devtoolsEnabled}>{children}</ClientShell>
      </body>
    </html>
  );
}
