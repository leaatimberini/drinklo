export type IntegrationOrder = {
  externalId: string;
  status: string;
  raw: unknown;
};

export type IntegrationAck = {
  externalId: string;
  accepted: boolean;
  reason?: string;
};

export type IntegrationStatus = {
  externalId: string;
  status: string;
  trackingCode?: string;
  raw?: unknown;
};

export type CatalogSyncPayload = {
  items: Array<{ sku: string; name: string; price: number; stock: number }>;
};

export interface IntegrationAdapter {
  orders: {
    pull: (since?: string) => Promise<IntegrationOrder[]>;
    ack: (ack: IntegrationAck) => Promise<void>;
  };
  status: {
    push: (update: IntegrationStatus) => Promise<void>;
  };
  catalog: {
    sync: (payload: CatalogSyncPayload) => Promise<void>;
  };
}
