import type {
  CatalogSyncPayload,
  IntegrationAdapter,
  IntegrationAck,
  IntegrationOrder,
  IntegrationStatus,
} from "./types";

export type PedidosYaConfig = {
  baseUrl: string;
  apiKey: string;
};

export class PedidosYaIntegration implements IntegrationAdapter {
  constructor(private readonly config: PedidosYaConfig) {}

  orders = {
    pull: async (since?: string): Promise<IntegrationOrder[]> => {
      // TODO: GET /orders?since=...
      void since;
      return [];
    },
    ack: async (ack: IntegrationAck): Promise<void> => {
      // TODO: POST /orders/{id}/ack
      void ack;
    },
  };

  status = {
    push: async (update: IntegrationStatus): Promise<void> => {
      // TODO: POST /orders/{id}/status
      void update;
    },
  };

  catalog = {
    sync: async (payload: CatalogSyncPayload): Promise<void> => {
      // TODO: POST /catalog
      void payload;
    },
  };

  webhookReceiver(payload: any) {
    // TODO: verify signature and map to internal order
    return payload;
  }
}
