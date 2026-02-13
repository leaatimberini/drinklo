import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

let sdk: NodeSDK | null = null;

export function initTelemetry() {
  if (sdk) return;
  const instrumentations = getNodeAutoInstrumentations();
  try {
    // Best-effort optional instrumentation. Avoid hard dependency to keep installs reliable.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@opentelemetry/instrumentation-bullmq") as any;
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
