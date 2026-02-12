import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@erp/db";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly readReplicas: PrismaClient[];
  private readReplicaIndex = 0;

  constructor() {
    super();
    const urls = (process.env.DATABASE_READ_REPLICA_URLS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    this.readReplicas = urls.map((url) => new PrismaClient({ datasourceUrl: url }));
  }

  async onModuleInit() {
    await this.$connect();
    await Promise.all(this.readReplicas.map((client) => client.$connect().catch(() => undefined)));
  }

  async onModuleDestroy() {
    await Promise.all(this.readReplicas.map((client) => client.$disconnect().catch(() => undefined)));
    await this.$disconnect();
  }

  getReadClient() {
    if (this.readReplicas.length === 0) {
      return this as unknown as PrismaClient;
    }
    const next = this.readReplicas[this.readReplicaIndex % this.readReplicas.length];
    this.readReplicaIndex = (this.readReplicaIndex + 1) % this.readReplicas.length;
    return next;
  }

  async withReadClient<T>(run: (client: PrismaClient) => Promise<T>) {
    return run(this.getReadClient());
  }

  getReadReplicaStatus() {
    return {
      configured: this.readReplicas.length,
      enabled: this.readReplicas.length > 0,
    };
  }
}
