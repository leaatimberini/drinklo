import crypto from "node:crypto";
import http from "node:http";

const port = Number(process.env.PORT ?? 4020);
const secret = process.env.WEBHOOK_SECRET ?? "change-me";

function verifySignature(signatureHeader, timestampHeader, body) {
  if (!signatureHeader || !timestampHeader) return false;

  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(",")
      .map((chunk) => chunk.trim().split("=")),
  );
  const ts = String(parts.t ?? timestampHeader);
  const v1 = String(parts.v1 ?? "");
  if (!ts || !v1) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405).end();
    return;
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk.toString();
  });

  req.on("end", () => {
    const signature = req.headers["x-devwebhook-signature"];
    const timestamp = req.headers["x-devwebhook-timestamp"];

    if (!verifySignature(signature, timestamp, raw)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, message: "invalid signature" }));
      return;
    }

    const event = JSON.parse(raw);
    console.log("received", event.event, event.id);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
});

server.listen(port, () => {
  console.log(`Webhook receiver listening on http://localhost:${port}`);
});
