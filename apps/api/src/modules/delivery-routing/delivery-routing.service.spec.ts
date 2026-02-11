import { DeliveryRoutingService } from "./delivery-routing.service";

const geocodingMock = {
  geocode: jest.fn(),
};

describe("DeliveryRoutingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildService(overrides: Partial<any> = {}) {
    const prisma = {
      deliveryWindow: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      deliveryRoute: {
        create: jest.fn().mockResolvedValue({ id: "route-1" }),
        findUnique: jest.fn().mockResolvedValue({ id: "route-1", stops: [] }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      deliveryStop: {
        createMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findMany: jest.fn(),
      },
      shippingZone: {
        findMany: jest.fn().mockResolvedValue([
          { id: "z1", maxDistanceKm: 5 },
          { id: "z2", maxDistanceKm: 20 },
        ]),
      },
      companySettings: {
        findFirst: jest.fn().mockResolvedValue({ depotLat: -34.6, depotLng: -58.4 }),
      },
      orderStatusEvent: {
        create: jest.fn(),
      },
      emailEventLog: {
        create: jest.fn(),
      },
      ...overrides,
    };

    return { service: new DeliveryRoutingService(prisma as any, geocodingMock as any), prisma };
  }

  it("generates route with ordered stops", async () => {
    const orders = [
      {
        id: "o1",
        addressLine1: "A 1",
        city: "CABA",
        state: "BA",
        postalCode: "1000",
        country: "AR",
        createdAt: new Date(),
      },
      {
        id: "o2",
        addressLine1: "B 2",
        city: "CABA",
        state: "BA",
        postalCode: "1001",
        country: "AR",
        createdAt: new Date(),
      },
    ];

    geocodingMock.geocode
      .mockResolvedValueOnce({ lat: -34.61, lng: -58.45 })
      .mockResolvedValueOnce({ lat: -34.7, lng: -58.6 });

    const { service, prisma } = buildService({
      order: {
        findMany: jest.fn().mockResolvedValue(orders),
      },
    });

    await service.generateRoute("c1", { date: "2026-02-11" });

    expect(prisma.deliveryRoute.create).toHaveBeenCalled();
    expect(prisma.deliveryStop.createMany).toHaveBeenCalled();
  });
});
