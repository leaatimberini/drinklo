export const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL ?? "http://localhost:3010";

export async function proxyControlPlane(path: string, init?: RequestInit) {
  const url = `${CONTROL_PLANE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  return { res, payload };
}

export function fallbackCatalog(locale = "es") {
  const isEn = String(locale).toLowerCase().startsWith("en");
  return {
    locale: isEn ? "en" : "es",
    icp: null,
    learnerKey: null,
    recommendations: [],
    courses: [
      {
        key: "kiosco-fast-start",
        icps: ["kiosco"],
        title: isEn ? "Kiosk: quick start" : "Kiosco: arranque rapido",
        summary: isEn ? "Catalog + Mercado Pago + first sale" : "Catalogo + Mercado Pago + primera venta",
        modules: [
          { key: "catalogo-express", title: isEn ? "Catalog import" : "Importacion de catalogo", description: "", durationMin: 12, quiz: null },
          { key: "cobros-mp", title: "Mercado Pago", description: "", durationMin: 18, quiz: { passPct: 70, questions: [{ id: "q1", prompt: "", options: ["A", "B", "C"] }] } },
          { key: "primera-venta-pos", title: isEn ? "First sale" : "Primera venta", description: "", durationMin: 15, quiz: null },
        ],
        progress: null,
      },
    ],
  };
}

