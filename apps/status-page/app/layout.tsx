import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Status Page | ERP",
  description: "Estado público de la plataforma",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="wrap">
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Link href="/"><strong>Status Page</strong></Link>
            <nav style={{ display: "flex", gap: 12 }}>
              <Link className="badge" href="/">Overview</Link>
              <Link className="badge" href="/subscribe">Subscribe</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

