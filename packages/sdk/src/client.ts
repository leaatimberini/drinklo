import { buildQueryString, paginate, sleep } from "./helpers";
import type {
  Category,
  CreateOrderInput,
  PaginatedResponse,
  PriceListPayload,
  Product,
  RequestOptions,
  RetryPolicy,
  SdkClientOptions,
  SdkErrorPayload,
  StockAvailability,
} from "./types";
import { SdkHttpError } from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY: RetryPolicy = {
  maxRetries: 2,
  backoffMs: 250,
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class ErpSdkClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly retry: RetryPolicy;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent?: string;

  constructor(options: SdkClientOptions) {
    if (!options.baseUrl) {
      throw new Error("baseUrl is required");
    }
    if (!options.apiKey) {
      throw new Error("apiKey is required");
    }

    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retry = {
      maxRetries: options.retry?.maxRetries ?? DEFAULT_RETRY.maxRetries,
      backoffMs: options.retry?.backoffMs ?? DEFAULT_RETRY.backoffMs,
    };
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent;
  }

  async request<TResponse = unknown, TBody = unknown>(options: RequestOptions<TBody>): Promise<TResponse> {
    const method = options.method ?? "GET";
    const query = buildQueryString(options.query as Record<string, string | number | boolean | null | undefined> | undefined);
    const url = `${this.baseUrl}${options.path}${query}`;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.retry.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          method,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            ...(this.userAgent ? { "User-Agent": this.userAgent } : {}),
            ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
            ...(options.headers ?? {}),
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });

        clearTimeout(timeout);

        if (!response.ok) {
          let details: unknown = undefined;
          try {
            details = await response.json();
          } catch {
            details = await response.text();
          }

          const payload: SdkErrorPayload = {
            status: response.status,
            message: typeof details === "object" && details !== null && "message" in details
              ? String((details as any).message)
              : `Request failed with status ${response.status}`,
            details,
          };

          if (attempt < this.retry.maxRetries && isRetryableStatus(response.status)) {
            await sleep(this.retry.backoffMs * (attempt + 1));
            continue;
          }

          throw new SdkHttpError(payload);
        }

        if (response.status === 204) {
          return undefined as TResponse;
        }

        return (await response.json()) as TResponse;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (error instanceof SdkHttpError) {
          throw error;
        }

        if (attempt < this.retry.maxRetries) {
          await sleep(this.retry.backoffMs * (attempt + 1));
          continue;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Request failed");
  }

  listProducts(input?: { q?: string; page?: number; pageSize?: number }) {
    return this.request<PaginatedResponse<Product>>({
      method: "GET",
      path: "/developer/v1/products",
      query: input,
    });
  }

  listCategories() {
    return this.request<Category[]>({
      method: "GET",
      path: "/developer/v1/categories",
    });
  }

  listPriceLists() {
    return this.request<PriceListPayload>({
      method: "GET",
      path: "/developer/v1/pricelists",
    });
  }

  listStockAvailability() {
    return this.request<StockAvailability[]>({
      method: "GET",
      path: "/developer/v1/stock/availability",
    });
  }

  createOrder(payload: CreateOrderInput, options?: { idempotencyKey?: string }) {
    // Uses checkout endpoint (public store flow) until /developer/v1/orders is exposed.
    return this.request<Record<string, unknown>, CreateOrderInput>({
      method: "POST",
      path: "/checkout/orders",
      body: payload,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  paginateProducts(options?: { q?: string; pageSize?: number; maxPages?: number }) {
    return paginate<Product>(
      (page, pageSize) => this.listProducts({ q: options?.q, page, pageSize }),
      { pageSize: options?.pageSize, maxPages: options?.maxPages },
    );
  }
}
