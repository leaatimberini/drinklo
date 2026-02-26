import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { createRequire } from "node:module";

let sdk: NodeSDK | null = null;
const requireModule = createRequire(__filename);

export function initTelemetry() {
  if (sdk) return;
  const instrumentations = getNodeAutoInstrumentations();
  try {
    // Best-effort optional instrumentation. Avoid hard dependency to keep installs reliable.
    const mod = requireModule("@opentelemetry/instrumentation-bullmq") as unknown;
    const Ctor = mod?.BullMQInstrumentation;
    if (Ctor) {
      instrumentations.push(new Ctor());
    }
  } catch {
    // optional
  }

  sdk = new NodeSDK({
    instrumentations,
  });

  sdk.start();
}

export async function shutdownTelemetry() {
  if (sdk) {
    await sdk.shutdown();
  }
}
