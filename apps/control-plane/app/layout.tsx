import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Control Plane",
  description: "Provider control plane",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
