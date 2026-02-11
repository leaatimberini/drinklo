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
  if (!target) return NextResponse.next();

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
        return response;
      }
    }
  } catch {
    // ignore
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/categories/:path*", "/products/:path*", "/checkout/:path*"],
};
