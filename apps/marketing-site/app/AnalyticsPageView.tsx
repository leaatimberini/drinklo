"use client";

import { useEffect } from "react";
import { trackMarketingEvent } from "./lib/analytics";

export function AnalyticsPageView({ page }: { page: string }) {
  useEffect(() => {
    trackMarketingEvent("page_view", { page });
  }, [page]);
  return null;
}

