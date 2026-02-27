"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

type AuthGateProps = {
  children: ReactNode;
  devtoolsEnabled: boolean;
};

const PUBLIC_WHEN_READY = new Set(["/login"]);
const PUBLIC_WHEN_NOT_INITIALIZED = new Set(["/install"]);

export function AuthGate({ children, devtoolsEnabled }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, initialized, user } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!initialized) {
      if (!PUBLIC_WHEN_NOT_INITIALIZED.has(pathname)) {
        router.replace("/install");
      }
      return;
    }

    if (!user) {
      if (!PUBLIC_WHEN_READY.has(pathname)) {
        router.replace("/login");
      }
      return;
    }

    if (pathname === "/login" || pathname === "/install") {
      router.replace("/");
      return;
    }

    if (pathname.startsWith("/dev/tools") && !devtoolsEnabled) {
      router.replace("/");
    }
  }, [devtoolsEnabled, initialized, loading, pathname, router, user]);

  if (loading) {
    return <main style={{ padding: 32 }}>Loading session...</main>;
  }

  if (!initialized && !PUBLIC_WHEN_NOT_INITIALIZED.has(pathname)) {
    return null;
  }

  if (initialized && !user && !PUBLIC_WHEN_READY.has(pathname)) {
    return null;
  }

  if (pathname.startsWith("/dev/tools") && !devtoolsEnabled) {
    return null;
  }

  return <>{children}</>;
}
