import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function mapTarget(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/categories")) return "HOME";
  if (pathname.startsWith("/products")) return "PDP";
  if (pathname.startsWith("/checkout")) return "CHECKOUT";
  return null;
}

export async function middleware(req: NextRequest) {
  const target = mapTarget(req.nextUrl.pathname);
  const shouldEdgeCache =
    req.nextUrl.pathname === "/" ||
    req.nextUrl.pathname.startsWith("/categories") ||
    req.nextUrl.pathname.startsWith("/products");

  if (!target) {
    const passthrough = NextResponse.next();
    if (shouldEdgeCache) {
      passthrough.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    }
    return passthrough;
  }

  const cookie = req.cookies.get("erp_ab")?.value ?? "";
  try {
    const res = await fetch(`${API_URL}/experiments/assign?target=${target}`, {
      headers: cookie ? { cookie: `erp_ab=${cookie}` } : undefined,
      cache: "no-store",
    });
    if (res.ok) {
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const response = NextResponse.next();
        response.headers.set("set-cookie", setCookie);
        if (shouldEdgeCache) {
          response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
        }
        return response;
      }
    }
  } catch {
    // ignore
  }

  const response = NextResponse.next();
  if (shouldEdgeCache) {
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  }
  return response;
}

export const config = {
  matcher: ["/", "/categories/:path*", "/products/:path*", "/checkout/:path*"],
};
