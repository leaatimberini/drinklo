export type PluginManifest = {
  name: string;
  version: string;
  permissions: string[];
  hooks?: string[];
  uiSlots?: string[];
  signature?: string;
};

export type PluginContext = {
  companyId: string;
  scopes: string[];
};

export type ProductDecoratorHook = (input: {
  product: unknown;
  context: PluginContext;
}) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;

export type PricingRuleHook = (input: {
  item: { productId: string; variantId?: string | null; quantity: number; unitPrice: number };
  context: PluginContext;
}) => Promise<{ unitPrice?: number; label?: string } | null> | { unitPrice?: number; label?: string } | null;

export type UiSlotHook = (input: {
  slot: string;
  context: PluginContext;
}) => Promise<Array<{ title: string; body: string }> | null> | Array<{ title: string; body: string }> | null;

export type PluginModule = {
  hooks?: {
    "product.decorate"?: ProductDecoratorHook;
    "pricing.unitPrice"?: PricingRuleHook;
  };
  uiSlots?: Record<string, UiSlotHook>;
};
