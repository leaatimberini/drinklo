export function getCatalogApiBases() {
  const primary = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const fallbacks = (process.env.NEXT_PUBLIC_API_READ_FALLBACK_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [primary, ...fallbacks.filter((url) => url !== primary)];
}

export async function fetchCatalog(path: string, init?: RequestInit) {
  const bases = getCatalogApiBases();
  let lastError: unknown;

  for (const base of bases) {
    try {
      const headers = new Headers(init?.headers);
      headers.set("x-catalog-region-fallback", "true");
      const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
        ...init,
        headers,
      });
      if (response.ok) {
        return response;
      }
      lastError = new Error(`catalog request failed on ${base}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("catalog request failed");
}

export async function fetchCatalogJson<T>(path: string, init?: RequestInit) {
  const response = await fetchCatalog(path, init);
  return response.json() as Promise<T>;
}
