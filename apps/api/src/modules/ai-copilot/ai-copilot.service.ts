import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AiCopilotActionType, type AiCopilotProposalStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";
import { redactDeep, dlpSummary } from "../data-governance/dlp-redactor";
import { ImmutableAuditService } from "../immutable-audit/immutable-audit.service";

type CopilotUser = {
  sub: string;
  companyId: string;
  role: string;
  permissions: string[];
};

type CopilotActionPreview = {
  actionType: AiCopilotActionType;
  requiredPermission: string;
  title: string;
  details: Record<string, any>;
};

@Injectable()
export class AiCopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ImmutableAuditService,
  ) {}

  async chat(user: CopilotUser, prompt: string, mode = "admin") {
    const redactedPrompt = redactDeep(prompt);
    const promptDlp = dlpSummary(prompt);
    const messages: string[] = [];
    const proposals: any[] = [];

    if (this.hasKeyword(prompt, ["venta", "ventas"])) {
      if (this.hasPermission(user, "pricing:read")) {
        const sales = await this.salesInsight(user.companyId);
        messages.push(`Ventas 30d: ARS ${sales.total.toFixed(2)} en ${sales.tickets} tickets.`);
      } else {
        messages.push("Sin permiso para consultar ventas.");
      }
    }

    if (this.hasKeyword(prompt, ["stock", "inventario"])) {
      if (this.hasPermission(user, "inventory:read")) {
        const low = await this.lowStockInsight(user.companyId);
        messages.push(`Stock critico (<=5): ${low.count} variantes.`);
      } else {
        messages.push("Sin permiso para consultar stock.");
      }
    }

    if (this.hasKeyword(prompt, ["cliente", "clientes"])) {
      if (this.hasPermission(user, "customers:read")) {
        const customers = await this.customerInsight(user.companyId);
        messages.push(`Clientes activos: ${customers.total}. Nuevos 30d: ${customers.new30d}.`);
      } else {
        messages.push("Sin permiso para consultar clientes.");
      }
    }

    if (this.hasKeyword(prompt, ["compra", "compras", "po", "orden de compra"])) {
      if (this.hasPermission(user, "inventory:read")) {
        const purchasing = await this.purchasingInsight(user.companyId);
        messages.push(`Compras: ${purchasing.open} OC abiertas, ${purchasing.approved} aprobadas.`);
      } else {
        messages.push("Sin permiso para consultar compras.");
      }
    }

    if (this.hasKeyword(prompt, ["campana", "campanas", "campaign"])) {
      if (this.hasPermission(user, "settings:write") || user.role === "marketing") {
        const campaigns = await this.campaignInsight(user.companyId);
        messages.push(`Campanas: ${campaigns.active} activas, ${campaigns.draft} draft, ${campaigns.paused} pausadas.`);
      } else {
        messages.push("Sin permiso para consultar campanas.");
      }
    }

    const actionPreviews = this.buildActionPreviews(prompt);
    for (const preview of actionPreviews) {
      if (!this.hasPermission(user, preview.requiredPermission)) {
        messages.push(`No autorizado para proponer accion: ${preview.title}.`);
        continue;
      }
      const proposal = await this.prisma.aiCopilotProposal.create({
        data: {
          companyId: user.companyId,
          createdByUserId: user.sub,
          status: "PENDING" as AiCopilotProposalStatus,
          actionType: preview.actionType,
          requiredPermission: preview.requiredPermission,
          promptRedacted: String(redactedPrompt),
          preview: preview as any,
        },
      });
      proposals.push(proposal);
      messages.push(`Propuesta creada: ${preview.title}. Requiere aprobacion explicita.`);
    }

    if (messages.length === 0) {
      messages.push("No pude inferir una consulta o accion. Proba con ventas/stock/clientes/compras/campanas o una accion concreta.");
    }

    const response = {
      message: messages.join("\n"),
      proposals,
      approvalRequired: true,
    };

    await this.prisma.aiCopilotLog.create({
      data: {
        companyId: user.companyId,
        userId: user.sub,
        mode,
        promptRedacted: String(redactedPrompt),
        response: redactDeep(response),
        status: "ok",
        dlp: promptDlp as any,
      },
    });

    return response;
  }

  async listProposals(companyId: string, status = "PENDING") {
    return this.prisma.aiCopilotProposal.findMany({
      where: {
        companyId,
        status: status as AiCopilotProposalStatus,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async approveProposal(user: CopilotUser, proposalId: string, note?: string) {
    const proposal = await this.prisma.aiCopilotProposal.findFirst({
      where: { id: proposalId, companyId: user.companyId },
    });
    if (!proposal) {
      throw new NotFoundException("Proposal not found");
    }
    if (proposal.status !== "PENDING") {
      throw new BadRequestException("Proposal is not pending");
    }
    if (!this.hasPermission(user, proposal.requiredPermission)) {
      throw new ForbiddenException("Not allowed to approve this proposal");
    }

    await this.prisma.aiCopilotProposal.update({
      where: { id: proposal.id },
      data: {
        status: "APPROVED",
        approvedByUserId: user.sub,
        approvedAt: new Date(),
      },
    });

    const execution = await this.executeProposal(user, proposal as any);
    const updated = await this.prisma.aiCopilotProposal.update({
      where: { id: proposal.id },
      data: {
        status: execution.ok ? "EXECUTED" : "FAILED",
        executedAt: new Date(),
        executionResult: redactDeep({ ...execution, note: note ?? null }),
      },
    });

    await this.audit.append({
      companyId: user.companyId,
      category: this.auditCategory(proposal.actionType),
      action: `AI_COPILOT_APPROVE:${proposal.actionType}`,
      method: "POST",
      route: "/admin/copilot/proposals/:id/approve",
      statusCode: execution.ok ? 200 : 400,
      actorUserId: user.sub,
      actorRole: user.role,
      aggregateType: "ai-copilot",
      aggregateId: proposal.id,
      payload: {
        proposalId: proposal.id,
        actionType: proposal.actionType,
        note: note ?? null,
        result: execution,
      },
    });

    return { proposal: updated, execution };
  }

  private async executeProposal(user: CopilotUser, proposal: { actionType: AiCopilotActionType; preview: any }) {
    const details = proposal.preview?.details ?? {};

    if (proposal.actionType === "CREATE_COUPON") {
      const code = String(details.code ?? `COPI-${Date.now().toString().slice(-6)}`);
      const amount = Number(details.amount ?? 10);
      const type = String(details.type ?? "PERCENT");
      const created = await this.prisma.coupon.create({
        data: {
          companyId: user.companyId,
          code,
          type: type as any,
          amount: new Prisma.Decimal(amount),
          currency: "ARS",
          active: true,
        },
      });
      return { ok: true, resource: "coupon", id: created.id, code: created.code };
    }

    if (proposal.actionType === "CREATE_PURCHASE_ORDER") {
      const supplierName = String(details.supplierName ?? "Proveedor Copiloto");
      const sku = String(details.variantSku ?? "");
      const qty = Math.max(1, Number(details.quantity ?? 10));
      const unitCost = Number(details.unitCost ?? 1000);

      let supplier = await this.prisma.supplier.findFirst({
        where: { companyId: user.companyId, name: supplierName, deletedAt: null },
      });
      if (!supplier) {
        supplier = await this.prisma.supplier.create({
          data: { companyId: user.companyId, name: supplierName },
        });
      }

      const variant = sku
        ? await this.prisma.productVariant.findFirst({ where: { companyId: user.companyId, sku, deletedAt: null } })
        : await this.prisma.productVariant.findFirst({ where: { companyId: user.companyId, deletedAt: null } });

      if (!variant) {
        return { ok: false, error: "No variant available for purchase order" };
      }

      const order = await this.prisma.purchaseOrder.create({
        data: {
          companyId: user.companyId,
          supplierId: supplier.id,
          status: "DRAFT",
          currency: "ARS",
          totalAmount: new Prisma.Decimal(qty * unitCost),
          createdById: user.sub,
        },
      });

      const item = await this.prisma.purchaseOrderItem.create({
        data: {
          companyId: user.companyId,
          purchaseOrderId: order.id,
          variantId: variant.id,
          quantityOrdered: qty,
          unitCost: new Prisma.Decimal(unitCost),
        },
      });

      return { ok: true, resource: "purchaseOrder", id: order.id, itemId: item.id };
    }

    if (proposal.actionType === "ADJUST_STOCK") {
      const sku = String(details.variantSku ?? "");
      const delta = Number(details.delta ?? 0);
      if (!sku || !Number.isFinite(delta) || delta === 0) {
        return { ok: false, error: "Invalid stock adjustment payload" };
      }

      const variant = await this.prisma.productVariant.findFirst({
        where: { companyId: user.companyId, sku, deletedAt: null },
      });
      if (!variant) {
        return { ok: false, error: "Variant not found" };
      }

      const stockItem = await this.prisma.stockItem.findFirst({
        where: { companyId: user.companyId, variantId: variant.id, deletedAt: null },
      });
      if (!stockItem) {
        return { ok: false, error: "Stock item not found" };
      }

      const updated = await this.prisma.stockItem.update({
        where: { id: stockItem.id },
        data: { quantity: stockItem.quantity + delta, updatedById: user.sub },
      });

      await this.prisma.stockMovement.create({
        data: {
          companyId: user.companyId,
          stockItemId: stockItem.id,
          delta,
          reason: "copilot_adjustment",
          createdById: user.sub,
        },
      });

      return { ok: true, resource: "stockItem", id: updated.id, newQuantity: updated.quantity };
    }

    return { ok: false, error: "Unsupported action" };
  }

  private buildActionPreviews(prompt: string): CopilotActionPreview[] {
    const previews: CopilotActionPreview[] = [];

    if (this.hasKeyword(prompt, ["cupon", "coupon"])) {
      previews.push({
        actionType: "CREATE_COUPON",
        requiredPermission: "pricing:write",
        title: "Crear cupon promocional",
        details: {
          code: `COPI-${Date.now().toString().slice(-6)}`,
          type: "PERCENT",
          amount: 10,
          currency: "ARS",
        },
      });
    }

    if (this.hasKeyword(prompt, ["orden de compra", "po", "purchase order", "armar po"])) {
      const sku = this.extractSku(prompt);
      previews.push({
        actionType: "CREATE_PURCHASE_ORDER",
        requiredPermission: "inventory:write",
        title: "Crear orden de compra draft",
        details: {
          supplierName: "Proveedor Copiloto",
          variantSku: sku,
          quantity: 10,
          unitCost: 1000,
          currency: "ARS",
        },
      });
    }

    if (this.hasKeyword(prompt, ["ajustar stock", "ajuste stock", "stock +", "stock -"])) {
      const sku = this.extractSku(prompt);
      const delta = this.extractDelta(prompt) ?? 1;
      previews.push({
        actionType: "ADJUST_STOCK",
        requiredPermission: "inventory:write",
        title: "Ajustar stock de variante",
        details: {
          variantSku: sku,
          delta,
          reason: "copilot_adjustment",
        },
      });
    }

    return previews;
  }

  private extractSku(prompt: string) {
    const match = prompt.match(/sku\s*[:=\-]?\s*([A-Za-z0-9\-_]+)/i);
    return match?.[1] ?? "";
  }

  private extractDelta(prompt: string) {
    const match = prompt.match(/([+-]\d{1,5})/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  private hasPermission(user: CopilotUser, permission: string) {
    return user.permissions?.includes(permission);
  }

  private hasKeyword(input: string, keywords: string[]) {
    const normalized = input.toLowerCase();
    return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
  }

  private auditCategory(actionType: AiCopilotActionType) {
    if (actionType === "CREATE_COUPON") return "pricing" as const;
    if (actionType === "ADJUST_STOCK") return "stock" as const;
    return "configuration" as const;
  }

  private async salesInsight(companyId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | number; tickets: bigint | number }>>`
      SELECT COALESCE(SUM("total"),0) as total,
             COUNT(*) as tickets
      FROM "Sale"
      WHERE "companyId" = ${companyId}
        AND "createdAt" >= ${since}
    `;
    const row = rows[0];
    return {
      total: Number((row?.total as any) ?? 0),
      tickets: Number((row?.tickets as any) ?? 0),
    };
  }

  private async lowStockInsight(companyId: string) {
    const count = await this.prisma.stockItem.count({
      where: {
        companyId,
        deletedAt: null,
        quantity: { lte: 5 },
      },
    });
    return { count };
  }

  private async customerInsight(companyId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, new30d] = await Promise.all([
      this.prisma.customer.count({ where: { companyId, deletedAt: null } }),
      this.prisma.customer.count({ where: { companyId, createdAt: { gte: since }, deletedAt: null } }),
    ]);
    return { total, new30d };
  }

  private async purchasingInsight(companyId: string) {
    const [open, approved] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { companyId, status: { in: ["DRAFT", "APPROVED"] } } }),
      this.prisma.purchaseOrder.count({ where: { companyId, status: "APPROVED" } }),
    ]);
    return { open, approved };
  }

  private async campaignInsight(companyId: string) {
    const [active, draft, paused] = await Promise.all([
      this.prisma.campaign.count({ where: { companyId, status: "ACTIVE" } }),
      this.prisma.campaign.count({ where: { companyId, status: "DRAFT" } }),
      this.prisma.campaign.count({ where: { companyId, status: "PAUSED" } }),
    ]);
    return { active, draft, paused };
  }
}
