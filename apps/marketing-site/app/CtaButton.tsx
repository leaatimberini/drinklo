"use client";

import Link from "next/link";
import { trackMarketingEvent } from "./lib/analytics";

export function CtaButton({
  href,
  children,
  variant = "primary",
  eventName = "cta_click",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  eventName?: string;
}) {
  return (
    <Link
      href={href}
      className={`btn ${variant === "primary" ? "primary" : ""}`}
      onClick={() => trackMarketingEvent(eventName, { href })}
    >
      {children}
    </Link>
  );
}

