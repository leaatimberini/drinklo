import { Injectable } from "@nestjs/common";
import type { StorageAdapter } from "./storage.types";
import { S3StorageAdapter } from "./s3.adapter";

@Injectable()
export class StorageService {
  private readonly adapter: StorageAdapter;
  private readonly signedUrlTtlSeconds: number;
  private readonly publicFallbackTtlSeconds: number;

  constructor() {
    const bucket = process.env.STORAGE_BUCKET ?? "erp";
    const region = process.env.STORAGE_REGION ?? "us-east-1";
    const accessKeyId = process.env.STORAGE_ACCESS_KEY ?? "minioadmin";
    const secretAccessKey = process.env.STORAGE_SECRET_KEY ?? "minioadmin";
    const endpoint = process.env.STORAGE_ENDPOINT;
    const forcePathStyle = process.env.STORAGE_FORCE_PATH_STYLE === "true";
    const publicBaseUrl = process.env.STORAGE_PUBLIC_URL;

    this.signedUrlTtlSeconds = Number(process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? 900);
    this.publicFallbackTtlSeconds = Number(process.env.STORAGE_PUBLIC_FALLBACK_TTL_SECONDS ?? 604800);

    this.adapter = new S3StorageAdapter({
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
      endpoint,
      forcePathStyle,
      publicBaseUrl,
    });
  }

  async put(key: string, body: Buffer, contentType?: string, cacheControl?: string) {
    return this.adapter.put({ key, body, contentType, cacheControl });
  }

  async get(key: string) {
    return this.adapter.get(key);
  }

  async delete(key: string) {
    return this.adapter.delete(key);
  }

  async signedUrl(key: string, expiresInSeconds?: number) {
    return this.adapter.signedUrl(key, expiresInSeconds ?? this.signedUrlTtlSeconds);
  }

  async publicUrl(key: string) {
    if (this.adapter.publicUrl) {
      return this.adapter.publicUrl(key);
    }
    return this.adapter.signedUrl(key, this.publicFallbackTtlSeconds);
  }

  async list(prefix: string) {
    if (!this.adapter.list) {
      return [];
    }
    return this.adapter.list(prefix);
  }
}
