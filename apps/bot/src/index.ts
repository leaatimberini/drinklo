import "dotenv/config";
import { Telegraf, Markup, type Context } from "telegraf";
import { emitEvent } from "./events";

const token = process.env.BOT_TOKEN;
const allowlist = (process.env.BOT_ALLOWLIST ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const adminRole = (process.env.BOT_ADMIN_ROLE ?? "admin").toLowerCase();

if (!token) {
  throw new Error("BOT_TOKEN is required");
}

const apiUrl = process.env.API_URL ?? "http://localhost:3001";
const eventToken = process.env.EVENT_INGEST_TOKEN;
const bot = new Telegraf(token);
const rateMap = new Map<string, { count: number; reset: number }>();

type BotContext = Context;
type CopilotProposal = { id: string; actionType: string };
type CopilotChatResponse = { message?: string; proposals?: CopilotProposal[] };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function log(event: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(event));
}

function isAllowed(ctx: BotContext) {
  const chatId = String(ctx.chat?.id ?? "");
  return allowlist.length > 0 && allowlist.includes(chatId);
}

async function trackCommand(
  command: string,
  ctx: BotContext,
  status: string,
  payload?: unknown,
  adminId?: string,
) {
  await emitEvent(
    apiUrl,
    "BotCommand",
    {
      command,
      status,
      chatId: String(ctx.chat?.id ?? ""),
      userId: String(ctx.from?.id ?? ""),
      payload,
      adminId: adminId ?? null,
    },
    { subjectId: adminId ?? null, token: eventToken },
  );

  await emitEvent(
    apiUrl,
    "FeatureUsageEvent",
    {
      feature: "bot",
      action: "command",
      command,
      status,
    },
    { subjectId: adminId ?? null, token: eventToken },
  );
}

async function getAdminToken() {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.BOT_ADMIN_EMAIL, password: process.env.BOT_ADMIN_PASSWORD }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (String(data?.user?.role ?? "").toLowerCase() !== adminRole) return null;
  return { token: data.accessToken, adminId: data.user.id };
}

async function audit(
  command: string,
  chatId: string,
  status: string,
  result?: unknown,
  adminId?: string,
  token?: string,
) {
  if (!token) return;
  try {
    await fetch(`${apiUrl}/admin/bot-audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId, command, status, result, adminId }),
    });
  } catch {
    // ignore
  }
}

function checkRateLimit(chatId: string) {
  const now = Date.now();
  const entry = rateMap.get(chatId) ?? { count: 0, reset: now + 60000 };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 60000;
  }
  entry.count += 1;
  rateMap.set(chatId, entry);
  return entry.count <= 20;
}

bot.use(async (ctx, next) => {
  const requestId = `bot-${ctx.update.update_id}`;
  const start = Date.now();
  try {
    await next();
    log({
      level: "info",
      msg: "bot_update",
      requestId,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      route: ctx.updateType,
      durationMs: Date.now() - start,
      status: "ok",
    });
  } catch (error: unknown) {
    log({
      level: "error",
      msg: "bot_update",
      requestId,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      route: ctx.updateType,
      durationMs: Date.now() - start,
      status: "error",
      error: errorMessage(error),
    });
    throw error;
  }
});

bot.start((ctx) => ctx.reply("ERP bot online"));

bot.command("stock", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/stock", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/stock", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const admin = await getAdminToken();
  if (!admin) {
    await trackCommand("/stock", ctx, "invalid_admin");
    return ctx.reply("Admin credentials invalid");
  }

  const text = ctx.message.text ?? "";
  const q = text.split(" ").slice(1).join(" ");
  const res = await fetch(`${apiUrl}/sales/products?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  await ctx.reply(JSON.stringify(data.slice(0, 5), null, 2));
  await audit("/stock", chatId, "ok", { q }, admin.adminId, admin.token);
  await trackCommand("/stock", ctx, "ok", { q }, admin.adminId);
});

bot.command("precio", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/precio", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/precio", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const admin = await getAdminToken();
  if (!admin) {
    await trackCommand("/precio", ctx, "invalid_admin");
    return ctx.reply("Admin credentials invalid");
  }

  const text = ctx.message.text ?? "";
  const q = text.split(" ").slice(1).join(" ");
  const res = await fetch(`${apiUrl}/sales/products?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  await ctx.reply(JSON.stringify(data.slice(0, 1), null, 2));
  await audit("/precio", chatId, "ok", { q }, admin.adminId, admin.token);
  await trackCommand("/precio", ctx, "ok", { q }, admin.adminId);
});

bot.command("cupon", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/cupon", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/cupon", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const admin = await getAdminToken();
  if (!admin) {
    await trackCommand("/cupon", ctx, "invalid_admin");
    return ctx.reply("Admin credentials invalid");
  }

  const text = ctx.message.text ?? "";
  const args = text.split(" ").slice(1);
  const code = args[0];
  const subtotal = Number(args[1] ?? 0);
  if (!code) {
    return ctx.reply("Uso: /cupon <codigo> <subtotal>");
  }

  const res = await fetch(`${apiUrl}/admin/promos/coupons/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ code, subtotal }),
  });
  const data = await res.json();
  await ctx.reply(JSON.stringify(data, null, 2));
  await audit("/cupon", chatId, "ok", { code, subtotal }, admin.adminId, admin.token);
  await trackCommand("/cupon", ctx, "ok", { code, subtotal }, admin.adminId);
});

bot.command("giftcard_saldo", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/giftcard_saldo", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/giftcard_saldo", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const admin = await getAdminToken();
  if (!admin) {
    await trackCommand("/giftcard_saldo", ctx, "invalid_admin");
    return ctx.reply("Admin credentials invalid");
  }

  const text = ctx.message.text ?? "";
  const code = text.split(" ").slice(1).join(" ");
  if (!code) {
    return ctx.reply("Uso: /giftcard_saldo <codigo>");
  }

  const res = await fetch(`${apiUrl}/admin/promos/giftcards/${encodeURIComponent(code)}/balance`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const data = await res.json();
  await ctx.reply(JSON.stringify(data, null, 2));
  await audit("/giftcard_saldo", chatId, "ok", { code }, admin.adminId, admin.token);
  await trackCommand("/giftcard_saldo", ctx, "ok", { code }, admin.adminId);
});

bot.command("cliente_nuevo", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/cliente_nuevo", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/cliente_nuevo", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const text = ctx.message.text ?? "";
  const name = text.split(" ").slice(1).join(" ");
  const message = `Crear cliente ${name}?`;
  await ctx.reply(message, Markup.inlineKeyboard([
    Markup.button.callback("Confirmar", `customer:create:${name}`),
  ]));
  await trackCommand("/cliente_nuevo", ctx, "pending", { name });
});

bot.command("presupuesto_pdf", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/presupuesto_pdf", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/presupuesto_pdf", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const admin = await getAdminToken();
  if (!admin) {
    await trackCommand("/presupuesto_pdf", ctx, "invalid_admin");
    return ctx.reply("Admin credentials invalid");
  }

  const text = ctx.message.text ?? "";
  const args = text.split(" ").slice(1);
  const customer = args.shift() ?? "Cliente";
  const itemsRaw = args.join(" ");
  const items = itemsRaw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [productId, qtyRaw] = chunk.split(":");
      return { productId, quantity: Number(qtyRaw ?? 1) };
    });

  if (items.length === 0) {
    await trackCommand("/presupuesto_pdf", ctx, "invalid_args");
    return ctx.reply("Uso: /presupuesto_pdf <cliente> <productId:qty,productId:qty>");
  }

  const res = await fetch(`${apiUrl}/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerName: customer, items, discount: 0 }),
  });

  if (!res.ok) {
    await trackCommand("/presupuesto_pdf", ctx, "error", { customer });
    return ctx.reply("Error creando presupuesto");
  }

  const quote = await res.json();
  const pdfRes = await fetch(`${apiUrl}/quotes/${quote.id}/pdf`);
  const buffer = await pdfRes.arrayBuffer();

  await ctx.replyWithDocument({ source: Buffer.from(buffer), filename: `presupuesto-${quote.id}.pdf` });
  await audit("/presupuesto_pdf", chatId, "ok", { quoteId: quote.id }, admin.adminId, admin.token);
  await trackCommand("/presupuesto_pdf", ctx, "ok", { quoteId: quote.id }, admin.adminId);
});

bot.command("lista_precios", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/lista_precios", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/lista_precios", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const admin = await getAdminToken();
  if (!admin) {
    await trackCommand("/lista_precios", ctx, "invalid_admin");
    return ctx.reply("Admin credentials invalid");
  }

  const res = await fetch(`${apiUrl}/catalog/products?page=1&pageSize=5`);
  const data = await res.json();
  await ctx.reply(JSON.stringify(data.items ?? [], null, 2));
  await audit("/lista_precios", chatId, "ok", undefined, admin.adminId, admin.token);
  await trackCommand("/lista_precios", ctx, "ok", undefined, admin.adminId);
});

bot.command("pedido_estado", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/pedido_estado", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/pedido_estado", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const admin = await getAdminToken();
  if (!admin) {
    await trackCommand("/pedido_estado", ctx, "invalid_admin");
    return ctx.reply("Admin credentials invalid");
  }

  const text = ctx.message.text ?? "";
  const orderId = text.split(" ").slice(1).join(" ");
  const res = await fetch(`${apiUrl}/checkout/orders/${orderId}/status`);
  const data = await res.json();
  await ctx.reply(JSON.stringify(data, null, 2));
  await audit("/pedido_estado", chatId, "ok", { orderId }, admin.adminId, admin.token);
  await trackCommand("/pedido_estado", ctx, "ok", { orderId }, admin.adminId);
});

bot.command("copiloto", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("/copiloto", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("/copiloto", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  const admin = await getAdminToken();
  if (!admin) {
    await trackCommand("/copiloto", ctx, "invalid_admin");
    return ctx.reply("Admin credentials invalid");
  }

  const text = ctx.message.text ?? "";
  const prompt = text.split(" ").slice(1).join(" ").trim();
  if (!prompt) {
    await trackCommand("/copiloto", ctx, "invalid_args");
    return ctx.reply("Uso: /copiloto <consulta o accion>");
  }

  const res = await fetch(`${apiUrl}/admin/copilot/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` },
    body: JSON.stringify({ prompt, mode: "telegram" }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    await trackCommand("/copiloto", ctx, "error", payload, admin.adminId);
    return ctx.reply(payload.message ?? "Error en copiloto");
  }

  const data: CopilotChatResponse = await res.json();
  const buttons = (data.proposals ?? [])
    .slice(0, 4)
    .map((proposal) =>
      [Markup.button.callback(`Aprobar ${proposal.actionType}`, `copilot:approve:${proposal.id}`)]);

  if (buttons.length > 0) {
    await ctx.reply(String(data.message ?? "Respuesta copiloto"), Markup.inlineKeyboard(buttons));
  } else {
    await ctx.reply(String(data.message ?? "Respuesta copiloto"));
  }

  await audit("/copiloto", chatId, "ok", { proposals: (data.proposals ?? []).length }, admin.adminId, admin.token);
  await trackCommand("/copiloto", ctx, "ok", { proposals: (data.proposals ?? []).length }, admin.adminId);
});

bot.on("callback_query", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!checkRateLimit(chatId)) {
    await trackCommand("callback", ctx, "rate_limited");
    return ctx.reply("Rate limit");
  }
  if (!isAllowed(ctx)) {
    await trackCommand("callback", ctx, "denied");
    return ctx.reply("No autorizado");
  }

  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
    await ctx.answerCbQuery();
    return;
  }
  const data = ctx.callbackQuery.data ?? "";
  if (data.startsWith("customer:create:")) {
    const admin = await getAdminToken();
    if (!admin) {
      await trackCommand("/cliente_nuevo", ctx, "invalid_admin");
      return ctx.reply("Admin credentials invalid");
    }

    const name = data.replace("customer:create:", "");
    const res = await fetch(`${apiUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await ctx.reply(`Cliente creado: ${name}`);
      await audit("/cliente_nuevo", chatId, "ok", { name }, admin.adminId, admin.token);
      await trackCommand("/cliente_nuevo", ctx, "ok", { name }, admin.adminId);
    } else {
      await ctx.reply("Error creando cliente");
      await audit("/cliente_nuevo", chatId, "error", { name }, admin.adminId, admin.token);
      await trackCommand("/cliente_nuevo", ctx, "error", { name }, admin.adminId);
    }
  }
  if (data.startsWith("copilot:approve:")) {
    const admin = await getAdminToken();
    if (!admin) {
      await trackCommand("/copiloto", ctx, "invalid_admin");
      return ctx.reply("Admin credentials invalid");
    }
    const proposalId = data.replace("copilot:approve:", "");
    const res = await fetch(`${apiUrl}/admin/copilot/proposals/${proposalId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ note: "approved_from_telegram" }),
    });
    const payload = await res.json().catch(() => ({}));
    if (res.ok) {
      await ctx.reply(`Copiloto ejecutado: ${payload?.execution?.resource ?? "ok"}`);
      await audit("/copiloto", chatId, "ok", { proposalId }, admin.adminId, admin.token);
      await trackCommand("/copiloto", ctx, "ok", { proposalId }, admin.adminId);
    } else {
      await ctx.reply(payload.message ?? "No se pudo aprobar la propuesta");
      await audit("/copiloto", chatId, "error", { proposalId, payload }, admin.adminId, admin.token);
      await trackCommand("/copiloto", ctx, "error", { proposalId }, admin.adminId);
    }
  }
  await ctx.answerCbQuery();
});

bot.launch();

// eslint-disable-next-line no-console
console.log("Bot running");
