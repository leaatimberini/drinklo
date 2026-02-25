"use client";

import { useEffect, useState } from "react";

export function RestrictedModeBanner() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [state, setState] = useState<any | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/themes/public`)
      .then((res) => res.json())
      .then((data) => setState(data?.runtime ?? null))
      .catch(() => undefined);
  }, [apiUrl]);

  if (!state?.restricted?.enabled) return null;
  const variant = state.restricted?.variant ?? "ALLOW_BASIC_SALES";
  return (
    <div
      style={{
        margin: "12px",
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: "1px solid #dc2626",
        background: "#fef2f2",
      }}
    >
      <strong>Suscripción en modo RESTRICTED</strong>
      <div>
        Lectura y exportación siguen habilitadas. Ediciones no esenciales están bloqueadas.
        {variant === "CATALOG_ONLY"
          ? " Storefront en modo catálogo (checkout deshabilitado)."
          : " Storefront con ventas básicas permitidas."}
      </div>
      <div>
        <a href="/plan-billing">Actualizar plan</a>
      </div>
    </div>
  );
}

