import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_MARKETING_SITE_URL ?? "http://localhost:3013"),
  title: {
    default: "SUCHT ERP | Plataforma para Bebidas",
    template: "%s | SUCHT ERP",
  },
  description: "ERP omnicanal para retail, distribuidoras y operaciones enterprise de bebidas.",
  openGraph: {
    title: "SUCHT ERP - Vertical Bebidas",
    description: "Retail, distribuidora y enterprise en una sola plataforma.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="container">
          <header className="nav">
            <div>
              <strong>SUCHT</strong> <span className="muted">Vertical Bebidas</span>
            </div>
            <nav className="nav-links" aria-label="Principal">
              <Link href="/">Inicio</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/signup">Probar 30 días</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

