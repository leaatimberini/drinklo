"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";
import { AuthGate } from "./auth-gate";

type ClientShellProps = {
  children: ReactNode;
  devtoolsEnabled: boolean;
};

export function ClientShell({ children, devtoolsEnabled }: ClientShellProps) {
  return (
    <AuthProvider>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <ThemeProvider target="admin" />
      <AuthGate devtoolsEnabled={devtoolsEnabled}>
        <div id="main-content">{children}</div>
      </AuthGate>
    </AuthProvider>
  );
}
