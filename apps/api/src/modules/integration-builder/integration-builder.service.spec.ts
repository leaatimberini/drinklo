import { IntegrationConnectorAuthMode, IntegrationConnectorDeliveryStatus } from "@erp/db";
import { IntegrationBuilderService } from "./integration-builder.service";

function makeConfig() {
  return {
    get: (key: string) =>
      ({
        CONTROL_PLANE_URL: "",
        CONTROL_PLANE_INGEST_TOKEN: "",
        INSTANCE_ID: "test-inst",
      } as Record<string, any>)[key],
  } as any;
}

function makePrisma(deliveryOverrides?: Partial<any>) {
  const baseDelivery = {
    id: "d1",
    companyId: "co1",
    connectorId: "c1",
    eventId: "evt1",
    sourceEvent: "OrderCreated",
    status: "PROCESSING",
    attemptCount: 0,
    maxAttempts: 2,
    eventEnvelope: { id: "evt1", name: "OrderCreated", payload: { orderId: "o1" }, source: "api" },
    connector: {
      id: "c1",
      deletedAt: null,
      enabled: true,
      mapping: { orderId: "$.payload.orderId" },
      headers: {},
      method: "POST",
      destinationUrl: "https://example.test/webhook",
      authMode: IntegrationConnectorAuthMode.NONE,
      authHeaderName: null,
      timeoutMs: 1000,
      retryBackoffBaseMs: 1000,
      secretProviderKey: null,
    },
  };
  const delivery = { ...baseDelivery, ...deliveryOverrides, connector: { ...baseDelivery.connector, ...(deliveryOverrides?.connector ?? {}) } };

  return {
    integrationConnectorDelivery: {
      findUnique: jest.fn().mockResolvedValue(delivery),
      update: jest.fn().mockResolvedValue({ id: "d1" }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    },
    integrationConnector: {
      update: jest.fn().mockResolvedValue({ id: "c1" }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    secret: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe("IntegrationBuilderService", () => {
  it("schedules retry on failure before max attempts", async () => {
    const prisma = makePrisma({ attemptCount: 0, maxAttempts: 3 });
    const secrets = { getSecret: jest.fn().mockResolvedValue(null) } as any;
    const service = new IntegrationBuilderService(prisma, secrets, makeConfig());
    jest.spyOn(service as any, "performHttp").mockRejectedValue(new Error("timeout"));

    await (service as any).executeDelivery("d1");
    service.onModuleDestroy();

    expect(prisma.integrationConnectorDelivery.update).toHaveBeenCalled();
    const updateData = prisma.integrationConnectorDelivery.update.mock.calls[0][0].data;
    expect(updateData.status).toBe(IntegrationConnectorDeliveryStatus.RETRY_SCHEDULED);
    expect(updateData.nextAttemptAt).toBeInstanceOf(Date);
  });

  it("moves to DLQ after max attempts reached", async () => {
    const prisma = makePrisma({ attemptCount: 1, maxAttempts: 2 });
    const secrets = { getSecret: jest.fn().mockResolvedValue(null) } as any;
    const service = new IntegrationBuilderService(prisma, secrets, makeConfig());
    jest.spyOn(service as any, "performHttp").mockRejectedValue(new Error("HTTP 500"));

    await (service as any).executeDelivery("d1");
    service.onModuleDestroy();

    const updateData = prisma.integrationConnectorDelivery.update.mock.calls[0][0].data;
    expect(updateData.status).toBe(IntegrationConnectorDeliveryStatus.DLQ);
    expect(updateData.nextAttemptAt).toBeNull();
  });
});

