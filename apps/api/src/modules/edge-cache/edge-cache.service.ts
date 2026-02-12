import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EdgeCacheHeaders, type InvalidationEvent, type WebVitalSample } from "./edge-cache.types";

@Injectable()
export class EdgeCacheService {
  private readonly logger = new Logger(EdgeCacheService.name);
  private readonly controlPlaneUrl: string;
  private readonly controlPlaneToken: string;
  private readonly instanceId: string;

  constructor(private readonly config: ConfigService) {
    this.controlPlaneUrl = this.config.get<string>("CONTROL_PLANE_URL") ?? "";
    this.controlPlaneToken = this.config.get<string>("CONTROL_PLANE_INGEST_TOKEN") ?? "";
    this.instanceId = this.config.get<string>("INSTANCE_ID") ?? "local-dev";
  }

  getHeaders() {
    return EdgeCacheHeaders;
  }

  async purgeProduct(companyId: string, productId: string, reason = "product_updated") {
    const paths = ["/", "/products", "/categories", `/products/${productId}`, "/sitemap.xml"];
    const tags = ["catalog", `company:${companyId}`, `product:${productId}`];
    return this.dispatchInvalidation({
      instanceId: this.instanceId,
      companyId,
      reason,
      tags,
      paths,
      payload: { productId },
    });
  }

  async purgePricing(companyId: string, variantSkus: string[], reason = "price_updated") {
    const tags = ["catalog", `company:${companyId}`, "pricing"];
    const skuTags = variantSkus.slice(0, 30).map((sku) => `sku:${sku}`);
    return this.dispatchInvalidation({
      instanceId: this.instanceId,
      companyId,
      reason,
      tags: [...tags, ...skuTags],
      paths: ["/", "/products", "/categories", "/search", "/sitemap.xml"],
      payload: { variantSkus: variantSkus.slice(0, 200) },
    });
  }

  async reportWebVital(sample: Omit<WebVitalSample, "instanceId">) {
    const payload: WebVitalSample = {
      instanceId: this.instanceId,
      ...sample,
    };
    await this.post("/api/edge/vitals", payload);
  }

  async dispatchInvalidation(event: InvalidationEvent) {
    await this.post("/api/edge/invalidate", event);
  }

  private async post(path: string, payload: any) {
    if (!this.controlPlaneUrl || !this.controlPlaneToken) {
      return;
    }
    const url = `${this.controlPlaneUrl.replace(/\/$/, "")}${path}`;
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cp-ingest-token": this.controlPlaneToken,
        },
        body: JSON.stringify(payload),
      });
    } catch (error: any) {
      this.logger.warn(`control-plane ingest failed: ${error?.message ?? "unknown"}`);
    }
  }
}
