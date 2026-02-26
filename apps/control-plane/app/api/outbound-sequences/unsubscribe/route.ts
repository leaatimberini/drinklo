import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { unsubscribeOutboundRecipient } from "../../../lib/outbound-sequences";

function responseHtml(email?: string | null) {
  const safeEmail = email ? String(email).replace(/[<>&"]/g, "") : null;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Suscripcion cancelada</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #0b1020; color: #e5e7eb; }
    main { max-width: 640px; margin: 3rem auto; padding: 1.5rem; background: #111827; border-radius: 12px; }
    h1 { margin: 0 0 0.75rem; font-size: 1.25rem; }
    p { line-height: 1.4; color: #cbd5e1; }
    code { background: #1f2937; padding: 0.1rem 0.35rem; border-radius: 6px; }
  </style>
</head>
<body>
  <main>
    <h1>Preferencias actualizadas</h1>
    <p>Ya no recibiras mensajes de secuencias outbound para ${safeEmail ? `<code>${safeEmail}</code>` : "este correo"}.</p>
    <p>Si fue un error, podes responder al equipo comercial para volver a suscribirte.</p>
  </main>
</body>
</html>`;
}

async function handleWithValues(req: NextRequest, emailRaw: string | null | undefined, reasonRaw?: string | null) {
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const reason = String(reasonRaw ?? "unsubscribe_link").trim();
  if (!email) {
    return new NextResponse(responseHtml(null), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  try {
    await unsubscribeOutboundRecipient(prisma as any, {
      email,
      source: "public_unsubscribe",
      reason,
      ip: req.headers.get("x-forwarded-for") ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
  } catch {
    // best effort to avoid leaking recipient existence
  }

  return new NextResponse(responseHtml(email), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  return handleWithValues(
    req,
    req.nextUrl.searchParams.get("e"),
    req.nextUrl.searchParams.get("reason"),
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  let email: string | null = null;
  let reason: string | null = null;
  if (form) {
    const e = form.get("email");
    const r = form.get("reason");
    if (typeof e === "string") email = e;
    if (typeof r === "string") reason = r;
  } else {
    const body = await req.json().catch(() => null);
    if (body?.email) email = String(body.email);
    if (body?.reason) reason = String(body.reason);
  }
  return handleWithValues(req, email, reason);
}
