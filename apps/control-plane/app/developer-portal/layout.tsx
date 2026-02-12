import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/developer-portal", label: "Overview" },
  { href: "/developer-portal/auth", label: "Auth" },
  { href: "/developer-portal/webhooks", label: "Webhooks" },
  { href: "/developer-portal/troubleshooting", label: "Troubleshooting" },
  { href: "/developer-portal/openapi", label: "OpenAPI" },
  { href: "/developer-portal/changelog", label: "Changelog" },
];

export default function DeveloperPortalLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <h1>Developer Portal</h1>
      <p>Partner and provider docs for public Developer API v1.</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <Link href="/">Control Plane</Link>
        {" | "}
        {navItems.map((item, idx) => (
          <span key={item.href}>
            {idx > 0 ? " | " : ""}
            <Link href={item.href}>{item.label}</Link>
          </span>
        ))}
      </div>
      {children}
    </main>
  );
}
