import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus } from "@erp/db";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FulfillmentService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(companyId: string, status?: string) {
    const whereStatus = status && Object.values(OrderStatus).includes(status as OrderStatus)
      ? (status as OrderStatus)
      : OrderStatus.PAID;

    return this.prisma.order.findMany({
      where: { companyId, status: whereStatus },
      orderBy: { createdAt: "asc" },
      include: {
        items: true,
      },
    });
  }

  async updateStatus(companyId: string, orderId: string, status: OrderStatus, userId?: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, companyId } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    await this.prisma.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status,
        message: `Order moved to ${status}${userId ? ` by ${userId}` : ""}`,
      },
    });

    return updated;
  }
}
