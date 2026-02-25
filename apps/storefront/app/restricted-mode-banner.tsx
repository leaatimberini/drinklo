"use client";

import { useEffect, useState } from "react";

export function RestrictedModeBanner() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [state, setState] = useState<any | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/themes/public`)
      .then((res) => res.json())
      .then((data) => setState(data?.runtime?.restricted ?? null))
      .catch(() => undefined);
  }, [apiUrl]);

  if (!state?.enabled) return null;
  const catalogOnly = state.variant === "CATALOG_ONLY" || state.storefrontCheckoutBlocked;
  return (
    <div
      style={{
        margin: "12px",
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: "1px solid #d97706",
        background: "#fffbeb",
      }}
    >
      <strong>Modo restringido</strong>
      <div>
        {catalogOnly
          ? "Storefront en modo catalogo: checkout deshabilitado temporalmente."
          : "Modo restringido activo: algunas capacidades premium estan limitadas, ventas basicas siguen habilitadas."}
      </div>
    </div>
  );
}

