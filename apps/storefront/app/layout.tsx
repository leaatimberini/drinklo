import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { CartProvider } from "./cart/cart-context";
import type { ReactNode } from "react";
import { AgeGate } from "./age-gate";
import { WebVitalsReporter } from "./web-vitals-reporter";

export const metadata = {
  title: "ERP Storefront",
  description: "Storefront",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebVitalsReporter />
        <ThemeProvider />
        <AgeGate />
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
