import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "./secret-crypto";

type SecretPayload = Record<string, any>;

const PROVIDER_MASKS: Record<string, (payload: SecretPayload) => Record<string, any>> = {
  MERCADOPAGO: (payload) => ({
    accessTokenLast4: payload.accessToken ? String(payload.accessToken).slice(-4) : undefined,
    publicKeyLast4: payload.publicKey ? String(payload.publicKey).slice(-4) : undefined,
  }),
  ANDREANI: (payload) => ({
    username: payload.username,
    contract: payload.contract,
    client: payload.client,
    category: payload.category,
  }),
  MERCADOLIBRE: (payload) => ({
    clientId: payload.clientId,
  }),
  ARCA: (payload) => ({
    certFingerprint: payload.certFingerprint,
  }),
};

@Injectable()
export class SecretsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.secret.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        provider: true,
        status: true,
        expiresAt: true,
        verifiedAt: true,
        rotatedAt: true,
        createdAt: true,
        updatedAt: true,
        meta: true,
      },
    });
  }

  async getStatus(companyId: string) {
    const now = new Date();
    const expired = await this.prisma.secret.count({
      where: { companyId, expiresAt: { lt: now } },
    });
    const unverified = await this.prisma.secret.count({
      where: { companyId, verifiedAt: null },
    });
    return { expired, unverified };
  }

  async getSecret(companyId: string, provider: string) {
    const secret = await this.prisma.secret.findUnique({
      where: { companyId_provider: { companyId, provider } },
    });
    if (!secret) return null;
    const plaintext = decryptSecret(secret);
    return JSON.parse(plaintext) as SecretPayload;
  }

  async rotateSecret(options: {
    companyId: string;
    provider: string;
    payload: SecretPayload;
    actorId?: string;
    expiresAt?: Date | null;
    verified?: boolean;
  }) {
    const { companyId, provider, payload, actorId, expiresAt, verified } = options;
    const encrypted = encryptSecret(JSON.stringify(payload));
    const metaBuilder = PROVIDER_MASKS[provider.toUpperCase()];
    const meta = metaBuilder ? metaBuilder(payload) : undefined;

    const now = new Date();
    const secret = await this.prisma.secret.upsert({
      where: { companyId_provider: { companyId, provider } },
      create: {
        companyId,
        provider,
        ...encrypted,
        status: "ACTIVE",
        rotatedAt: now,
        expiresAt: expiresAt ?? undefined,
        verifiedAt: verified ? now : undefined,
        meta: meta ?? undefined,
      },
      update: {
        ...encrypted,
        status: "ACTIVE",
        rotatedAt: now,
        expiresAt: expiresAt ?? undefined,
        verifiedAt: verified ? now : null,
        meta: meta ?? undefined,
      },
    });

    await this.prisma.secretAudit.create({
      data: {
        companyId,
        secretId: secret.id,
        actorId: actorId ?? null,
        action: "ROTATE",
        changes: {
          provider,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          verified: Boolean(verified),
        },
      },
    });

    return secret;
  }

  async markVerified(companyId: string, provider: string, actorId?: string) {
    const now = new Date();
    const secret = await this.prisma.secret.update({
      where: { companyId_provider: { companyId, provider } },
      data: { verifiedAt: now, status: "ACTIVE" },
    });

    await this.prisma.secretAudit.create({
      data: {
        companyId,
        secretId: secret.id,
        actorId: actorId ?? null,
        action: "VERIFY",
        changes: { provider, verifiedAt: now.toISOString() },
      },
    });

    return secret;
  }
}
