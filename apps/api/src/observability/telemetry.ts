import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { BullMQInstrumentation } from "@opentelemetry/instrumentation-bullmq";

let sdk: NodeSDK | null = null;

export function initTelemetry() {
  if (sdk) return;
  const instrumentations = getNodeAutoInstrumentations();
  try {
    instrumentations.push(new BullMQInstrumentation());
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
