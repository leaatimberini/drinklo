import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { CartProvider } from "./cart/cart-context";
import type { ReactNode } from "react";
import { AgeGate } from "./age-gate";
import { WebVitalsReporter } from "./web-vitals-reporter";
import { RestrictedModeBanner } from "./restricted-mode-banner";

export const metadata = {
  title: "ERP Storefront",
  description: "Storefront",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <WebVitalsReporter />
        <ThemeProvider />
        <RestrictedModeBanner />
        <AgeGate />
        <CartProvider>
          <div id="main-content">{children}</div>
        </CartProvider>
      </body>
    </html>
  );
}
