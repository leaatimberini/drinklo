export type RoleName = "admin" | "manager" | "caja" | "deposito" | "marketing" | "support";

export type MobileLoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: RoleName;
  };
};

export type StockLookupResponse = {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  stock: number;
};

export type ReceiveStockRequest = {
  variantId: string;
  locationId: string;
  quantity: number;
  reason?: string;
};

export type FulfillmentOrder = {
  id: string;
  customerName: string;
  status: string;
  items: Array<{ name: string; sku?: string | null; quantity: number }>;
};

export type UpdateOrderStatusRequest = {
  status: "PACKED" | "SHIPPED";
};
