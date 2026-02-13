"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { emitEvent } from "./lib/events";

function resolveFeatureKey(pathname: string) {
  const path = pathname.toLowerCase();
  if (path === "/dashboard") return "dashboard";
  if (path === "/pos") return "pos";
  if (path.startsWith("/automation")) return "campaigns";
  if (path.startsWith("/email-templates")) return "email_templates";
  if (path.startsWith("/email-domain")) return "email_domain";
  if (path.startsWith("/plugins-marketplace")) return "plugins";
  if (path.startsWith("/purchasing")) return "purchasing";
  if (path.startsWith("/lots")) return "inventory_lots";
  if (path.startsWith("/search")) return "search";
  if (path.startsWith("/integrations")) return "integrations";
  if (path.startsWith("/iam")) return "iam";
  if (path.startsWith("/secrets")) return "secrets";
  if (path.startsWith("/branding")) return "branding";
  if (path.startsWith("/developer-api")) return "developer_api";
  if (path.startsWith("/support")) return "support_portal";
  if (path.startsWith("/governance")) return "data_governance";
  if (path.startsWith("/privacy")) return "privacy";
  if (path.startsWith("/audit")) return "immutable_audit";
  if (path.startsWith("/bi")) return "warehouse_bi";
  if (path.startsWith("/sandbox")) return "sandbox";
  if (path === "/") return "setup_or_home";
  return "admin_other";
}

export function TelemetryTracker() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const eventToken = process.env.NEXT_PUBLIC_EVENT_TOKEN;
  const pathname = usePathname() ?? "/";
  const featureKey = useMemo(() => resolveFeatureKey(pathname), [pathname]);
  const lastSent = useRef<string>("");

  useEffect(() => {
    const signature = `${featureKey}:${pathname}`;
    if (lastSent.current === signature) return;
    lastSent.current = signature;

    emitEvent(
      apiUrl,
      "FeatureUsageEvent",
      {
        feature: featureKey,
        action: "view",
        pathname,
      },
      { token: eventToken },
    );
  }, [apiUrl, eventToken, featureKey, pathname]);

  return null;
}

