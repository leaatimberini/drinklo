import type { ApiMethod } from "./generated/openapi-types";

export type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions<TBody = unknown> = {
  method?: ApiMethod;
  path: string;
  query?: Record<string, QueryValue>;
  body?: TBody;
  headers?: Record<string, string>;
  timeoutMs?: number;
  idempotencyKey?: string;
};

export type RetryPolicy = {
  maxRetries: number;
  backoffMs: number;
};

export type SdkClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  retry?: Partial<RetryPolicy>;
  fetchImpl?: typeof fetch;
  userAgent?: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductVariant = {
  id: string;
  sku: string;
  barcode?: string | null;
  productId: string;
  [key: string]: unknown;
};

export type Product = {
  id: string;
  name: string;
  variants?: ProductVariant[];
  [key: string]: unknown;
};

export type Category = {
  id: string;
  name: string;
  [key: string]: unknown;
};

export type StockAvailability = {
  stockItemId: string;
  productId: string;
  variantId: string;
  sku: string;
  barcode?: string | null;
  locationId: string;
  locationName: string;
  quantity: number;
  reservedQuantity: number;
  available: number;
  updatedAt: string;
};

export type PriceListPayload = {
  lists: Array<Record<string, unknown>>;
  rules: Array<Record<string, unknown>>;
};

export type CreateOrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingMode: "PICKUP" | "DELIVERY";
  shippingProvider?: string;
  shippingOptionId?: string;
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  [key: string]: unknown;
};

export type SdkErrorPayload = {
  status: number;
  message: string;
  details?: unknown;
};

export class SdkHttpError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(payload: SdkErrorPayload) {
    super(payload.message);
    this.name = "SdkHttpError";
    this.status = payload.status;
    this.details = payload.details;
  }
}
