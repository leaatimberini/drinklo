import { Injectable } from "@nestjs/common";
import {
  Prisma,
  TaxPriceMode,
  TaxProfile,
  TaxRoundingMode,
  TaxRoundingScope,
  TaxRule,
  TaxRuleKind,
} from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import type { ReplaceTaxRulesDto, TaxSimulateDto, UpsertTaxProfileDto } from "./dto/taxes.dto";

type DbClient = PrismaService | Prisma.TransactionClient;

type TaxLocation = {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

type ResolvedCartItem = {
  productId?: string | null;
  categoryIds: string[];
  name?: string | null;
  quantity: number;
  unitPrice: number;
};

type CalculationInput = {
  currency?: string;
  shippingCost?: number;
  discountTotal?: number;
  address?: TaxLocation;
  items: ResolvedCartItem[];
};

type AppliedRuleLine = {
  ruleId: string;
  name: string;
  kind: TaxRuleKind;
  rate: number;
  priceMode?: TaxPriceMode | null;
  amount: number;
};

type CalculationLine = {
  index: number;
  productId?: string | null;
  categoryIds: string[];
  quantity: number;
  unitPrice: number;
  grossBeforeDiscount: number;
  discountAllocated: number;
  grossTaxableBase: number;
  netTaxableBase: number;
  ivaIncludedAmount: number;
  ivaExcludedAmount: number;
  perceptionAmount: number;
  withholdingAmount: number;
  payableDelta: number;
  appliedRules: AppliedRuleLine[];
};

type TaxCalculationResult = {
  profile: Pick<
    TaxProfile,
    | "id"
    | "name"
    | "currency"
    | "enabled"
    | "ivaDefaultMode"
    | "roundingMode"
    | "roundingScope"
    | "roundingIncrement"
  >;
  totals: {
    baseAmount: number;
    shippingAmount: number;
    discountAmount: number;
    ivaAmount: number;
    perceptionAmount: number;
    withholdingAmount: number;
    totalTaxAmount: number;
    totalAmount: number;
  };
  lines: CalculationLine[];
  shippingLines: AppliedRuleLine[];
  appliedRuleIds: string[];
  inputSnapshot: Record<string, unknown>;
};

const DEFAULT_PROFILE_INPUT = {
  name: "Default",
  currency: "ARS",
  ivaDefaultMode: "EXCLUDED" as const,
  roundingMode: "HALF_UP" as const,
  roundingScope: "TOTAL" as const,
  roundingIncrement: 0.01,
  enabled: true,
};

@Injectable()
export class TaxesService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(companyId: string) {
    const profile = await this.ensureDefaultProfile(companyId);
    return profile;
  }

  async upsertProfile(companyId: string, dto: UpsertTaxProfileDto, userId?: string) {
    const current = await this.ensureDefaultProfile(companyId);
    return this.prisma.taxProfile.update({
      where: { id: current.id },
      data: {
        name: dto.name ?? current.name,
        currency: dto.currency ?? current.currency,
        ivaDefaultMode: (dto.ivaDefaultMode as TaxPriceMode | undefined) ?? current.ivaDefaultMode,
        roundingMode: (dto.roundingMode as TaxRoundingMode | undefined) ?? current.roundingMode,
        roundingScope: (dto.roundingScope as TaxRoundingScope | undefined) ?? current.roundingScope,
        roundingIncrement:
          dto.roundingIncrement !== undefined
            ? new Prisma.Decimal(dto.roundingIncrement)
            : current.roundingIncrement,
        enabled: dto.enabled ?? current.enabled,
        updatedById: userId ?? null,
      },
    });
  }

  async listRules(companyId: string, profileId?: string) {
    const profile = profileId
      ? await this.prisma.taxProfile.findFirst({ where: { id: profileId, companyId } })
      : await this.ensureDefaultProfile(companyId);
    if (!profile) return [];
    return this.prisma.taxRule.findMany({
      where: { companyId, taxProfileId: profile.id, deletedAt: null },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });
  }

  async replaceRules(companyId: string, dto: ReplaceTaxRulesDto, userId?: string) {
    const profile = dto.profileId
      ? await this.prisma.taxProfile.findFirst({ where: { id: dto.profileId, companyId } })
      : await this.ensureDefaultProfile(companyId);
    if (!profile) {
      throw new Error("Tax profile not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.taxRule.findMany({
        where: { companyId, taxProfileId: profile.id, deletedAt: null },
      });
      const existingById = new Map(existing.map((r) => [r.id, r]));
      const keepIds = new Set<string>();

      const saved = [] as TaxRule[];
      for (const item of dto.items) {
        if (item.id && existingById.has(item.id)) {
          keepIds.add(item.id);
          const updated = await tx.taxRule.update({
            where: { id: item.id },
            data: {
              name: item.name,
              isActive: item.isActive ?? true,
              kind: item.kind as TaxRuleKind,
              rate: new Prisma.Decimal(item.rate),
              priceMode: item.priceMode ? (item.priceMode as TaxPriceMode) : null,
              priority: item.priority ?? 100,
              applyToShipping: item.applyToShipping ?? false,
              categoryId: item.categoryId ?? null,
              productId: item.productId ?? null,
              locationCountry: item.locationCountry ?? null,
              locationState: item.locationState ?? null,
              locationCity: item.locationCity ?? null,
              postalCodePrefix: item.postalCodePrefix ?? null,
              metadata: this.toNullableJsonInput(item.metadata),
              deletedAt: null,
              updatedById: userId ?? null,
            },
          });
          saved.push(updated);
          continue;
        }

        const created = await tx.taxRule.create({
          data: {
            companyId,
            taxProfileId: profile.id,
            name: item.name,
            isActive: item.isActive ?? true,
            kind: item.kind as TaxRuleKind,
            rate: new Prisma.Decimal(item.rate),
            priceMode: item.priceMode ? (item.priceMode as TaxPriceMode) : null,
            priority: item.priority ?? 100,
            applyToShipping: item.applyToShipping ?? false,
            categoryId: item.categoryId ?? null,
            productId: item.productId ?? null,
            locationCountry: item.locationCountry ?? null,
            locationState: item.locationState ?? null,
            locationCity: item.locationCity ?? null,
            postalCodePrefix: item.postalCodePrefix ?? null,
            metadata: this.toNullableJsonInput(item.metadata),
            createdById: userId ?? null,
            updatedById: userId ?? null,
          },
        });
        keepIds.add(created.id);
        saved.push(created);
      }

      const toDelete = existing.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
      if (toDelete.length > 0) {
        await tx.taxRule.updateMany({
          where: { id: { in: toDelete } },
          data: { deletedAt: new Date(), updatedById: userId ?? null },
        });
      }

      return saved.sort((a, b) => a.priority - b.priority);
    });
  }

  async simulate(companyId: string, dto: TaxSimulateDto) {
    const input = await this.enrichInputCategories(this.prisma, companyId, {
      currency: dto.currency,
      shippingCost: dto.shippingCost,
      discountTotal: dto.discountTotal,
      address: dto.address,
      items: dto.items.map((item) => ({
        productId: item.productId ?? null,
        categoryIds: item.categoryIds ?? [],
        name: item.name ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
    const { profile, rules } = await this.resolveProfileAndRules(this.prisma, companyId, dto.profileId);
    return this.calculate(profile, rules, input);
  }

  async calculateForCheckoutTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: CalculationInput & { profileId?: string },
  ) {
    const normalized = await this.enrichInputCategories(tx, companyId, input);
    const { profile, rules } = await this.resolveProfileAndRules(tx, companyId, input.profileId);
    return this.calculate(profile, rules, normalized);
  }

  buildOrderTaxBreakdownCreateInput(companyId: string, calc: TaxCalculationResult) {
    return {
      companyId,
      taxProfileId: calc.profile.id,
      currency: calc.profile.currency,
      engineVersion: "v1",
      baseAmount: new Prisma.Decimal(calc.totals.baseAmount),
      shippingAmount: new Prisma.Decimal(calc.totals.shippingAmount),
      discountAmount: new Prisma.Decimal(calc.totals.discountAmount),
      ivaAmount: new Prisma.Decimal(calc.totals.ivaAmount),
      perceptionAmount: new Prisma.Decimal(calc.totals.perceptionAmount),
      withholdingAmount: new Prisma.Decimal(calc.totals.withholdingAmount),
      totalTaxAmount: new Prisma.Decimal(calc.totals.totalTaxAmount),
      totalAmount: new Prisma.Decimal(calc.totals.totalAmount),
      roundingMode: calc.profile.roundingMode,
      roundingScope: calc.profile.roundingScope,
      roundingIncrement: new Prisma.Decimal(Number(calc.profile.roundingIncrement)),
      lines: {
        items: calc.lines,
        shipping: calc.shippingLines,
        appliedRuleIds: calc.appliedRuleIds,
      } as Prisma.InputJsonValue,
      inputSnapshot: calc.inputSnapshot as Prisma.InputJsonValue,
    };
  }

  private async ensureDefaultProfile(companyId: string) {
    const existing = await this.prisma.taxProfile.findFirst({
      where: { companyId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (existing) return existing;

    return this.prisma.taxProfile.create({
      data: {
        companyId,
        name: DEFAULT_PROFILE_INPUT.name,
        isDefault: true,
        currency: DEFAULT_PROFILE_INPUT.currency,
        ivaDefaultMode: DEFAULT_PROFILE_INPUT.ivaDefaultMode,
        roundingMode: DEFAULT_PROFILE_INPUT.roundingMode,
        roundingScope: DEFAULT_PROFILE_INPUT.roundingScope,
        roundingIncrement: new Prisma.Decimal(DEFAULT_PROFILE_INPUT.roundingIncrement),
        enabled: DEFAULT_PROFILE_INPUT.enabled,
      },
    });
  }

  private async resolveProfileAndRules(client: DbClient, companyId: string, profileId?: string) {
    let profile: TaxProfile | null = null;
    if (profileId) {
      profile = await client.taxProfile.findFirst({ where: { id: profileId, companyId } });
    } else {
      profile = await client.taxProfile.findFirst({
        where: { companyId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
    }
    if (!profile) {
      profile = await client.taxProfile.create({
        data: {
          companyId,
          name: DEFAULT_PROFILE_INPUT.name,
          isDefault: true,
          currency: DEFAULT_PROFILE_INPUT.currency,
          ivaDefaultMode: DEFAULT_PROFILE_INPUT.ivaDefaultMode,
          roundingMode: DEFAULT_PROFILE_INPUT.roundingMode,
          roundingScope: DEFAULT_PROFILE_INPUT.roundingScope,
          roundingIncrement: new Prisma.Decimal(DEFAULT_PROFILE_INPUT.roundingIncrement),
          enabled: DEFAULT_PROFILE_INPUT.enabled,
        },
      });
    }

    const rules = profile.enabled
      ? await client.taxRule.findMany({
      where: { companyId, taxProfileId: profile.id, deletedAt: null, isActive: true },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
        })
      : [];
    return { profile, rules };
  }

  private async enrichInputCategories(client: DbClient, companyId: string, input: CalculationInput) {
    const productIds = Array.from(
      new Set(input.items.map((item) => item.productId).filter((id): id is string => Boolean(id))),
    );

    const categoryMap = new Map<string, string[]>();
    if (productIds.length > 0) {
      const products = await client.product.findMany({
        where: { companyId, id: { in: productIds } },
        include: { productCats: true },
      });
      for (const product of products) {
        categoryMap.set(
          product.id,
          product.productCats.map((pc) => pc.categoryId),
        );
      }
    }

    return {
      ...input,
      items: input.items.map((item) => ({
        ...item,
        categoryIds:
          item.categoryIds && item.categoryIds.length > 0
            ? item.categoryIds
            : item.productId
              ? (categoryMap.get(item.productId) ?? [])
              : [],
      })),
    };
  }

  private calculate(profile: TaxProfile, rules: TaxRule[], input: CalculationInput): TaxCalculationResult {
    const roundingIncrement = Number(profile.roundingIncrement ?? 0.01);
    const roundingMode = profile.roundingMode ?? TaxRoundingMode.HALF_UP;
    const roundingScope = profile.roundingScope ?? TaxRoundingScope.TOTAL;
    const currency = input.currency ?? profile.currency ?? "ARS";
    const shippingCost = this.roundMoney(input.shippingCost ?? 0);

    const rawBaseAmount = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const baseAmount = this.roundMoney(rawBaseAmount);
    const discountAmount = this.roundMoney(Math.min(Math.max(input.discountTotal ?? 0, 0), baseAmount));
    const allocatedDiscounts = this.allocateDiscounts(input.items, discountAmount);

    const lines: CalculationLine[] = [];
    const shippingLines: AppliedRuleLine[] = [];
    let totalIva = 0;
    let totalPerception = 0;
    let totalWithholding = 0;
    let payableDelta = 0;
    const appliedRuleIds = new Set<string>();

    for (let index = 0; index < input.items.length; index += 1) {
      const item = input.items[index]!;
      const grossBeforeDiscount = this.roundMoney(item.unitPrice * item.quantity);
      const discountAllocated = allocatedDiscounts[index] ?? 0;
      const grossTaxableBase = this.roundMoney(Math.max(0, grossBeforeDiscount - discountAllocated));
      const itemRules = rules.filter((rule) => this.matchesRule(rule, item, input.address, false));

      const ivaRules = itemRules.filter((r) => r.kind === TaxRuleKind.IVA);
      const percRules = itemRules.filter((r) => r.kind === TaxRuleKind.PERCEPTION);
      const withRules = itemRules.filter((r) => r.kind === TaxRuleKind.WITHHOLDING);

      let includedRate = 0;
      let excludedRate = 0;
      for (const rule of ivaRules) {
        appliedRuleIds.add(rule.id);
        const mode = rule.priceMode ?? profile.ivaDefaultMode;
        if (mode === TaxPriceMode.INCLUDED) {
          includedRate += Number(rule.rate);
        } else {
          excludedRate += Number(rule.rate);
        }
      }

      const netTaxableBase =
        includedRate > 0 ? grossTaxableBase / (1 + includedRate) : grossTaxableBase;
      const ivaIncludedAmount = grossTaxableBase - netTaxableBase;
      const ivaExcludedAmount = netTaxableBase * excludedRate;

      let perceptionAmount = 0;
      for (const rule of percRules) {
        appliedRuleIds.add(rule.id);
        perceptionAmount += netTaxableBase * Number(rule.rate);
      }

      let withholdingAmount = 0;
      for (const rule of withRules) {
        appliedRuleIds.add(rule.id);
        withholdingAmount += netTaxableBase * Number(rule.rate);
      }

      let lineIvaIncluded = ivaIncludedAmount;
      let lineIvaExcluded = ivaExcludedAmount;
      let linePerception = perceptionAmount;
      let lineWithholding = withholdingAmount;

      if (roundingScope === TaxRoundingScope.LINE) {
        lineIvaIncluded = this.roundByIncrement(lineIvaIncluded, roundingIncrement, roundingMode);
        lineIvaExcluded = this.roundByIncrement(lineIvaExcluded, roundingIncrement, roundingMode);
        linePerception = this.roundByIncrement(linePerception, roundingIncrement, roundingMode);
        lineWithholding = this.roundByIncrement(lineWithholding, roundingIncrement, roundingMode);
      }

      totalIva += lineIvaIncluded + lineIvaExcluded;
      totalPerception += linePerception;
      totalWithholding += lineWithholding;
      payableDelta += lineIvaExcluded + linePerception - lineWithholding;

      const appliedRules: AppliedRuleLine[] = [];
      for (const rule of itemRules) {
        const ruleRate = Number(rule.rate);
        if (rule.kind === TaxRuleKind.IVA) {
          const mode = rule.priceMode ?? profile.ivaDefaultMode;
          const amount =
            mode === TaxPriceMode.INCLUDED
              ? includedRate > 0
                ? ((grossTaxableBase - netTaxableBase) * ruleRate) / includedRate
                : 0
              : netTaxableBase * ruleRate;
          appliedRules.push({
            ruleId: rule.id,
            name: rule.name,
            kind: rule.kind,
            rate: ruleRate,
            priceMode: mode,
            amount:
              roundingScope === TaxRoundingScope.LINE
                ? this.roundByIncrement(amount, roundingIncrement, roundingMode)
                : this.roundMoney(amount),
          });
        } else if (rule.kind === TaxRuleKind.PERCEPTION) {
          appliedRules.push({
            ruleId: rule.id,
            name: rule.name,
            kind: rule.kind,
            rate: ruleRate,
            amount:
              roundingScope === TaxRoundingScope.LINE
                ? this.roundByIncrement(netTaxableBase * ruleRate, roundingIncrement, roundingMode)
                : this.roundMoney(netTaxableBase * ruleRate),
          });
        } else {
          appliedRules.push({
            ruleId: rule.id,
            name: rule.name,
            kind: rule.kind,
            rate: ruleRate,
            amount:
              roundingScope === TaxRoundingScope.LINE
                ? this.roundByIncrement(-(netTaxableBase * ruleRate), roundingIncrement, roundingMode)
                : -this.roundMoney(netTaxableBase * ruleRate),
          });
        }
      }

      lines.push({
        index,
        productId: item.productId ?? null,
        categoryIds: item.categoryIds,
        quantity: item.quantity,
        unitPrice: this.roundMoney(item.unitPrice),
        grossBeforeDiscount,
        discountAllocated,
        grossTaxableBase: this.roundMoney(grossTaxableBase),
        netTaxableBase: this.roundMoney(netTaxableBase),
        ivaIncludedAmount: this.roundMoney(lineIvaIncluded),
        ivaExcludedAmount: this.roundMoney(lineIvaExcluded),
        perceptionAmount: this.roundMoney(linePerception),
        withholdingAmount: this.roundMoney(lineWithholding),
        payableDelta: this.roundMoney(lineIvaExcluded + linePerception - lineWithholding),
        appliedRules,
      });
    }

    const shippingRuleCandidates = rules.filter((rule) =>
      this.matchesRule(
        rule,
        { productId: null, categoryIds: [] },
        input.address,
        true,
      ),
    );
    if (shippingCost > 0 && shippingRuleCandidates.length > 0) {
      for (const rule of shippingRuleCandidates) {
        appliedRuleIds.add(rule.id);
        if (rule.kind === TaxRuleKind.IVA) {
          const mode = rule.priceMode ?? profile.ivaDefaultMode;
          const amount =
            mode === TaxPriceMode.INCLUDED
              ? shippingCost - shippingCost / (1 + Number(rule.rate))
              : shippingCost * Number(rule.rate);
          const rounded =
            roundingScope === TaxRoundingScope.LINE
              ? this.roundByIncrement(amount, roundingIncrement, roundingMode)
              : amount;
          totalIva += rounded;
          if (mode === TaxPriceMode.EXCLUDED) {
            payableDelta += rounded;
          }
          shippingLines.push({
            ruleId: rule.id,
            name: rule.name,
            kind: rule.kind,
            rate: Number(rule.rate),
            priceMode: mode,
            amount: this.roundMoney(rounded),
          });
        } else if (rule.kind === TaxRuleKind.PERCEPTION) {
          const amount = shippingCost * Number(rule.rate);
          const rounded =
            roundingScope === TaxRoundingScope.LINE
              ? this.roundByIncrement(amount, roundingIncrement, roundingMode)
              : amount;
          totalPerception += rounded;
          payableDelta += rounded;
          shippingLines.push({
            ruleId: rule.id,
            name: rule.name,
            kind: rule.kind,
            rate: Number(rule.rate),
            amount: this.roundMoney(rounded),
          });
        } else {
          const amount = shippingCost * Number(rule.rate);
          const rounded =
            roundingScope === TaxRoundingScope.LINE
              ? this.roundByIncrement(amount, roundingIncrement, roundingMode)
              : amount;
          totalWithholding += rounded;
          payableDelta -= rounded;
          shippingLines.push({
            ruleId: rule.id,
            name: rule.name,
            kind: rule.kind,
            rate: Number(rule.rate),
            amount: -this.roundMoney(rounded),
          });
        }
      }
    }

    if (roundingScope === TaxRoundingScope.TOTAL) {
      totalIva = this.roundByIncrement(totalIva, roundingIncrement, roundingMode);
      totalPerception = this.roundByIncrement(totalPerception, roundingIncrement, roundingMode);
      totalWithholding = this.roundByIncrement(totalWithholding, roundingIncrement, roundingMode);
      payableDelta = this.roundByIncrement(payableDelta, roundingIncrement, roundingMode);
    } else {
      totalIva = this.roundMoney(totalIva);
      totalPerception = this.roundMoney(totalPerception);
      totalWithholding = this.roundMoney(totalWithholding);
      payableDelta = this.roundMoney(payableDelta);
    }

    const totalTaxAmount = this.roundMoney(totalIva + totalPerception - totalWithholding);
    const totalAmount = this.roundMoney(baseAmount + shippingCost + payableDelta);

    return {
      profile: {
        id: profile.id,
        name: profile.name,
        currency,
        enabled: profile.enabled,
        ivaDefaultMode: profile.ivaDefaultMode,
        roundingMode,
        roundingScope,
        roundingIncrement: profile.roundingIncrement,
      },
      totals: {
        baseAmount,
        shippingAmount: shippingCost,
        discountAmount,
        ivaAmount: totalIva,
        perceptionAmount: totalPerception,
        withholdingAmount: totalWithholding,
        totalTaxAmount,
        totalAmount,
      },
      lines,
      shippingLines,
      appliedRuleIds: Array.from(appliedRuleIds).sort(),
      inputSnapshot: {
        currency,
        address: input.address ?? null,
        items: input.items.map((item, idx) => ({
          idx,
          productId: item.productId ?? null,
          categoryIds: item.categoryIds,
          quantity: item.quantity,
          unitPrice: this.roundMoney(item.unitPrice),
        })),
        shippingCost,
        discountTotal: discountAmount,
      },
    };
  }

  private matchesRule(
    rule: TaxRule,
    item: { productId?: string | null; categoryIds?: string[] },
    location?: TaxLocation,
    isShipping = false,
  ) {
    if (!rule.isActive || rule.deletedAt) return false;
    if (isShipping && !rule.applyToShipping) return false;
    if (!this.matchString(rule.locationCountry, location?.country)) return false;
    if (!this.matchString(rule.locationState, location?.state)) return false;
    if (!this.matchString(rule.locationCity, location?.city)) return false;
    if (!this.matchPostalPrefix(rule.postalCodePrefix, location?.postalCode)) return false;

    if (isShipping) {
      if (rule.productId || rule.categoryId) return false;
      return true;
    }

    if (rule.productId && rule.productId !== (item.productId ?? null)) return false;
    if (rule.categoryId && !(item.categoryIds ?? []).includes(rule.categoryId)) return false;
    return true;
  }

  private matchString(ruleValue?: string | null, actual?: string | null) {
    if (!ruleValue) return true;
    return String(actual ?? "").trim().toLowerCase() === ruleValue.trim().toLowerCase();
  }

  private matchPostalPrefix(prefix?: string | null, actual?: string | null) {
    if (!prefix) return true;
    return String(actual ?? "").trim().toLowerCase().startsWith(prefix.trim().toLowerCase());
  }

  private allocateDiscounts(items: Array<{ unitPrice: number; quantity: number }>, totalDiscount: number) {
    const grosses = items.map((item) => this.roundMoney(item.unitPrice * item.quantity));
    const subtotal = grosses.reduce((sum, value) => sum + value, 0);
    if (subtotal <= 0 || totalDiscount <= 0) {
      return items.map(() => 0);
    }

    let remaining = this.roundMoney(totalDiscount);
    return grosses.map((gross, index) => {
      if (index === grosses.length - 1) {
        return this.roundMoney(Math.max(0, remaining));
      }
      const portion = this.roundMoney((totalDiscount * gross) / subtotal);
      const applied = Math.min(portion, remaining);
      remaining = this.roundMoney(remaining - applied);
      return applied;
    });
  }

  private roundMoney(value: number) {
    return Number((Number.isFinite(value) ? value : 0).toFixed(2));
  }

  private roundByIncrement(value: number, increment: number, mode: TaxRoundingMode) {
    const safeIncrement = increment > 0 ? increment : 0.01;
    const ratio = value / safeIncrement;
    let roundedRatio: number;
    if (mode === TaxRoundingMode.UP) {
      roundedRatio = Math.ceil(ratio - 1e-9);
    } else if (mode === TaxRoundingMode.DOWN) {
      roundedRatio = Math.floor(ratio + 1e-9);
    } else {
      roundedRatio = Math.round(ratio);
    }
    return this.roundMoney(roundedRatio * safeIncrement);
  }

  private toNullableJsonInput(value: unknown) {
    if (value === undefined || value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }
}
