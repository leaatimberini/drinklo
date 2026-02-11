import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Control Plane",
  description: "Provider control plane",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
