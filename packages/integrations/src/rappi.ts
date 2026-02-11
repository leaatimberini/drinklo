import type {
  CatalogSyncPayload,
  IntegrationAdapter,
  IntegrationAck,
  IntegrationOrder,
  IntegrationStatus,
} from "./types";

export type RappiConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  merchantId: string;
};

export class RappiIntegration implements IntegrationAdapter {
  constructor(private readonly config: RappiConfig) {}

  async authenticate() {
    // TODO: implement OAuth or token exchange per Rappi docs
    return "";
  }

  orders = {
    pull: async (since?: string): Promise<IntegrationOrder[]> => {
      // TODO: fetch orders from Rappi API
      void since;
      return [];
    },
    ack: async (ack: IntegrationAck): Promise<void> => {
      // TODO: acknowledge order
      void ack;
    },
  };

  status = {
    push: async (update: IntegrationStatus): Promise<void> => {
      // TODO: update order status
      void update;
    },
  };

  catalog = {
    sync: async (payload: CatalogSyncPayload): Promise<void> => {
      // TODO: sync catalog
      void payload;
    },
  };
}
