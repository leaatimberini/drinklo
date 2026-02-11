import type {
  CatalogSyncPayload,
  IntegrationAdapter,
  IntegrationAck,
  IntegrationOrder,
  IntegrationStatus,
} from "./types";

export type MercadoLibreConfig = {
  baseUrl: string;
  accessToken: string;
  userId: string;
};

export class MercadoLibreIntegration implements IntegrationAdapter {
  constructor(private readonly config: MercadoLibreConfig) {}

  orders = {
    pull: async (since?: string): Promise<IntegrationOrder[]> => {
      // TODO: call /orders/search?seller={userId}&order.date_created.from=... and fetch details
      void since;
      return [];
    },
    ack: async (ack: IntegrationAck): Promise<void> => {
      // TODO: ack order in Mercado Libre (if applicable by resource)
      void ack;
    },
  };

  status = {
    push: async (update: IntegrationStatus): Promise<void> => {
      // TODO: update shipping status
      void update;
    },
  };

  catalog = {
    sync: async (payload: CatalogSyncPayload): Promise<void> => {
      // TODO: update listings
      void payload;
    },
  };

  async subscribeNotifications(callbackUrl: string, topic: "orders" | "shipments" | "items") {
    // TODO: POST /notifications
    void callbackUrl;
    void topic;
  }

  async fetchOrder(orderId: string) {
    // TODO: GET /orders/{orderId}
    void orderId;
    return null;
  }

  async fetchShipment(shipmentId: string) {
    // TODO: GET /shipments/{shipmentId}
    void shipmentId;
    return null;
  }
}
