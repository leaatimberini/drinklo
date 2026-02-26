import { Injectable } from "@nestjs/common";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { PrismaService } from "../prisma/prisma.service";
import type { PluginManifest, PluginModule } from "./plugin.types";

type PluginDefinition = {
  manifest: PluginManifest;
  module: PluginModule;
  root: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

function verifySignature(manifest: PluginManifest, secret: string) {
  if (!manifest.signature) return false;
  const payload = { ...manifest };
  delete (payload as unknown).signature;
  const expected = crypto.createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
  if (expected.length !== manifest.signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(manifest.signature));
}

function getPluginsRoot() {
  const candidates = [
    path.resolve(process.cwd(), "packages", "plugins"),
    path.resolve(process.cwd(), "..", "..", "packages", "plugins"),
    path.resolve(__dirname, "../../../../../packages/plugins"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

@Injectable()
export class PluginsService {
  private loaded = false;
  private plugins: PluginDefinition[] = [];

  constructor(private readonly prisma: PrismaService) {}

  private async loadPlugins() {
    if (this.loaded) return;
    this.loaded = true;

    const root = getPluginsRoot();
    if (!root) return;

    const secret = process.env.PLUGIN_SIGNING_SECRET ?? "";
    const allowUnsigned = process.env.PLUGIN_ALLOW_UNSIGNED === "true" || process.env.NODE_ENV !== "production";

    const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const dir of dirs) {
      const pluginRoot = path.join(root, dir.name);
      const manifestPath = path.join(pluginRoot, "manifest.json");
      const modulePath = path.join(pluginRoot, "plugin.mjs");
      if (!fs.existsSync(manifestPath) || !fs.existsSync(modulePath)) {
        continue;
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PluginManifest;
      const signed = secret ? verifySignature(manifest, secret) : false;
      if (!signed && !allowUnsigned) {
        continue;
      }
      const module = (await import(pathToFileURL(modulePath).href)) as PluginModule;
      this.plugins.push({ manifest, module, root: pluginRoot });
    }
  }

  private async getAllowedPlugins(companyId: string) {
    await this.loadPlugins();
    const allowlist = (process.env.PLUGIN_ALLOWLIST ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    const companyPlugins = await this.prisma.companyPlugin.findMany({
      where: { companyId, enabled: true },
    });
    const enabledMap = new Map(companyPlugins.map((p) => [p.name, p]));

    return this.plugins.filter((plugin) => {
      if (allowlist.length > 0 && !allowlist.includes(plugin.manifest.name)) return false;
      return enabledMap.has(plugin.manifest.name);
    });
  }

  async listAvailable(companyId: string) {
    await this.loadPlugins();
    const enabled = await this.prisma.companyPlugin.findMany({ where: { companyId } });
    const enabledMap = new Map(enabled.map((p) => [p.name, p]));
    return this.plugins.map((plugin) => {
      const record = enabledMap.get(plugin.manifest.name);
      return {
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        permissions: plugin.manifest.permissions,
        hooks: plugin.manifest.hooks ?? [],
        uiSlots: plugin.manifest.uiSlots ?? [],
        enabled: record?.enabled ?? false,
        allowedPermissions: record?.allowedPermissions ?? [],
      };
    });
  }

  async setPlugin(companyId: string, payload: { name: string; enabled: boolean; allowedPermissions?: string[] }) {
    const allowedPermissions = payload.allowedPermissions ?? [];
    return this.prisma.companyPlugin.upsert({
      where: { companyId_name: { companyId, name: payload.name } },
      update: { enabled: payload.enabled, allowedPermissions },
      create: { companyId, name: payload.name, enabled: payload.enabled, allowedPermissions },
    });
  }

  private getScopes(manifest: PluginManifest, record: { allowedPermissions: string[] }) {
    const allowed = record.allowedPermissions.length > 0 ? record.allowedPermissions : manifest.permissions;
    return manifest.permissions.filter((perm) => allowed.includes(perm));
  }

  async decorateProduct(companyId: string, product: unknown) {
    const plugins = await this.getAllowedPlugins(companyId);
    const records = await this.prisma.companyPlugin.findMany({
      where: { companyId, enabled: true },
    });
    const recordMap = new Map(records.map((r) => [r.name, r]));

    const decorations: Array<{ plugin: string; data: unknown }> = [];
    for (const plugin of plugins) {
      const hook = plugin.module.hooks?.["product.decorate"];
      if (!hook) continue;
      const record = recordMap.get(plugin.manifest.name);
      if (!record) continue;
      const scopes = this.getScopes(plugin.manifest, record);
      if (!scopes.includes("products:read")) {
        continue;
      }
      const result = await hook({ product, context: { companyId, scopes } });
      if (result) {
        decorations.push({ plugin: plugin.manifest.name, data: result });
      }
    }
    return { ...product, plugins: decorations };
  }

  async applyPricingRules(companyId: string, items: Array<{ productId: string; variantId?: string | null; quantity: number; unitPrice: number }>) {
    const plugins = await this.getAllowedPlugins(companyId);
    const records = await this.prisma.companyPlugin.findMany({
      where: { companyId, enabled: true },
    });
    const recordMap = new Map(records.map((r) => [r.name, r]));

    const updated = [];
    for (const item of items) {
      let unitPrice = item.unitPrice;
      for (const plugin of plugins) {
        const hook = plugin.module.hooks?.["pricing.unitPrice"];
        if (!hook) continue;
        const record = recordMap.get(plugin.manifest.name);
        if (!record) continue;
        const scopes = this.getScopes(plugin.manifest, record);
        if (!scopes.includes("pricing:write")) continue;
        const result = await hook({ item: { ...item, unitPrice }, context: { companyId, scopes } });
        if (result?.unitPrice != null) {
          unitPrice = result.unitPrice;
        }
      }
      updated.push({ ...item, unitPrice });
    }
    return updated;
  }

  async getUiSlots(companyId: string, slot: string) {
    const plugins = await this.getAllowedPlugins(companyId);
    const records = await this.prisma.companyPlugin.findMany({
      where: { companyId, enabled: true },
    });
    const recordMap = new Map(records.map((r) => [r.name, r]));

    const blocks: Array<{ plugin: string; title: string; body: string }> = [];
    for (const plugin of plugins) {
      const handler = plugin.module.uiSlots?.[slot];
      if (!handler) continue;
      const record = recordMap.get(plugin.manifest.name);
      if (!record) continue;
      const scopes = this.getScopes(plugin.manifest, record);
      const result = await handler({ slot, context: { companyId, scopes } });
      const items = Array.isArray(result) ? result : result ? [result] : [];
      for (const item of items) {
        blocks.push({ plugin: plugin.manifest.name, title: item.title, body: item.body });
      }
    }
    return blocks;
  }
}
