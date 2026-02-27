"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { SwRegister } from "./sw-register";
import { TelemetryTracker } from "./telemetry-tracker";
import { RestrictedModeBanner } from "./restricted-mode-banner";
import { ProductToursRunner } from "./product-tours-runner";
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
      <TelemetryTracker />
      <SwRegister />
      <RestrictedModeBanner />
      <ProductToursRunner />
      <AuthGate devtoolsEnabled={devtoolsEnabled}>
        <div id="main-content">{children}</div>
      </AuthGate>
    </AuthProvider>
  );
}
