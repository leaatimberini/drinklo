import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { SwRegister } from "./sw-register";
import type { ReactNode } from "react";
import { TelemetryTracker } from "./telemetry-tracker";
import { RestrictedModeBanner } from "./restricted-mode-banner";
import { ProductToursRunner } from "./product-tours-runner";
import { AuthProvider } from "./auth-provider";
import { AuthGate } from "./auth-gate";

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
        <AuthProvider>
          <a className="skip-link" href="#main-content">Skip to content</a>
          <ThemeProvider target="admin" />
          <TelemetryTracker />
          <SwRegister />
          <RestrictedModeBanner />
          <ProductToursRunner />
          <AuthGate devtoolsEnabled={devtoolsEnabled}>
            <div id="main-content">{children}</div>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
