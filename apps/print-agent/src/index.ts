import { WebSocketServer } from "ws";

const port = Number(process.env.PRINT_AGENT_PORT ?? 4161);
const wss = new WebSocketServer({ port });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    try {
      const payload = JSON.parse(data.toString());
      const preview = payload.content ?? "";
      // eslint-disable-next-line no-console
      console.log("Print job received", payload.type);
      // eslint-disable-next-line no-console
      console.log(preview);
      ws.send(JSON.stringify({ ok: true, previewLength: preview.length }));
    } catch (error) {
      ws.send(JSON.stringify({ ok: false, error: "invalid payload" }));
    }
  });
});

// eslint-disable-next-line no-console
console.log(`print-agent listening on ws://localhost:${port}`);
