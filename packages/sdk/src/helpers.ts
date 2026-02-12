import crypto from "node:crypto";
import type { PaginatedResponse } from "./types";

export function buildQueryString(query?: Record<string, string | number | boolean | null | undefined>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createIdempotencyKey(prefix = "erp-sdk"): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

export async function* paginate<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<T>>,
  options?: { pageSize?: number; startPage?: number; maxPages?: number },
): AsyncGenerator<T, void, void> {
  const pageSize = options?.pageSize ?? 50;
  let page = options?.startPage ?? 1;
  const maxPages = options?.maxPages ?? Number.POSITIVE_INFINITY;

  while (page <= maxPages) {
    const current = await fetchPage(page, pageSize);
    for (const item of current.items) {
      yield item;
    }

    const consumed = page * pageSize;
    if (consumed >= current.total || current.items.length === 0) {
      break;
    }

    page += 1;
  }
}
