import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SUCHT Academy",
  description: "Cursos guiados por ICP para activación y operación.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="ac-shell">
          <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
            <div>
              <Link href="/" style={{ fontWeight: 700, fontSize: 20 }}>Academy</Link>
              <div className="ac-muted" style={{ fontSize: 13 }}>Cursos por ICP, quizzes y certificación interna</div>
            </div>
            <nav style={{ display: "flex", gap: 10, fontSize: 14 }}>
              <Link href="/">Cursos</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

