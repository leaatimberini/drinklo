import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTokenForRole, type Role } from "./app/lib/auth";

const protectedPaths = ["/", "/installations", "/support"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }
  if (!protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const role = (req.cookies.get("cp_role")?.value ?? "") as Role;
  const token = req.cookies.get("cp_token")?.value ?? "";
  const expected = role ? getTokenForRole(role) : undefined;

  if (!expected || token !== expected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/installations/:path*", "/support"],
};
