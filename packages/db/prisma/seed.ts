import { Prisma, PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.create({
    data: { name: "Acme ERP" },
  });

  await prisma.companySettings.create({
    data: {
      companyId: company.id,
      brandName: "Acme",
      domain: "acme.local",
      logoUrl: "https://placehold.co/200x200",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
      storefrontTheme: "A",
      adminTheme: "A",
      depotAddress: "CABA",
      depotLat: -34.6037,
      depotLng: -58.3816,
    },
  });

  const branch = await prisma.branch.create({
    data: {
      companyId: company.id,
      name: "Casa Central",
      address: "CABA",
    },
  });

  await prisma.shippingZone.createMany({
    data: [
      { companyId: company.id, branchId: branch.id, name: "Cercana", maxDistanceKm: 5, baseFee: new Prisma.Decimal(1200), perKm: new Prisma.Decimal(50) },
      { companyId: company.id, branchId: branch.id, name: "Media", maxDistanceKm: 20, baseFee: new Prisma.Decimal(2500), perKm: new Prisma.Decimal(80) },
      { companyId: company.id, branchId: branch.id, name: "Lejana", maxDistanceKm: 60, baseFee: new Prisma.Decimal(4500), perKm: new Prisma.Decimal(120) },
    ],
  });

  const permissionCodes = [
    "products:read",
    "products:write",
    "pricing:read",
    "pricing:write",
    "inventory:read",
    "inventory:write",
    "users:read",
    "users:write",
    "customers:read",
    "customers:write",
    "settings:write",
  ];

  const permissions = await prisma.$transaction(
    permissionCodes.map((code) =>
      prisma.permission.create({
        data: {
          companyId: company.id,
          code,
          description: code.replace(":", " "),
        },
      }),
    ),
  );

  const role = await prisma.role.create({
    data: {
      companyId: company.id,
      name: "Admin",
      description: "System administrator",
    },
  });

  await prisma.$transaction(
    permissions.map((permission) =>
      prisma.rolePermission.create({
        data: {
          companyId: company.id,
          roleId: role.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      roleId: role.id,
      email: "admin@acme.local",
      name: "Admin User",
      passwordHash: await bcrypt.hash("admin123", 10),
    },
  });

  const [categoryOffice, categoryWarehouse] = await prisma.$transaction([
    prisma.category.create({
      data: { companyId: company.id, name: "Office", slug: "office" },
    }),
    prisma.category.create({
      data: { companyId: company.id, name: "Warehouse", slug: "warehouse" },
    }),
  ]);

  const priceListRetail = await prisma.priceList.create({
    data: {
      companyId: company.id,
      name: "Retail",
      currency: "USD",
      isDefault: true,
    },
  });

  const priceListWholesale = await prisma.priceList.create({
    data: {
      companyId: company.id,
      name: "Wholesale",
      currency: "USD",
      isDefault: false,
    },
  });

  const stockLocation = await prisma.stockLocation.create({
    data: {
      companyId: company.id,
      branchId: branch.id,
      name: "Main Warehouse",
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  for (let i = 1; i <= 10; i += 1) {
    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        name: `Product ${i}`,
        description: `Demo product ${i}`,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.productCategory.create({
      data: {
        companyId: company.id,
        productId: product.id,
        categoryId: i % 2 === 0 ? categoryOffice.id : categoryWarehouse.id,
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        companyId: company.id,
        productId: product.id,
        name: "Default",
        sku: `SKU-${String(i).padStart(3, "0")}`,
        barcode: `BC-${String(i).padStart(3, "0")}`,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const retailPrice = new Prisma.Decimal(10 + i);
    const wholesalePrice = new Prisma.Decimal(8 + i);

    await prisma.priceRule.createMany({
      data: [
        {
          companyId: company.id,
          priceListId: priceListRetail.id,
          variantId: variant.id,
          price: retailPrice,
        },
        {
          companyId: company.id,
          priceListId: priceListWholesale.id,
          variantId: variant.id,
          price: wholesalePrice,
        },
      ],
    });

    const stockItem = await prisma.stockItem.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        variantId: variant.id,
        locationId: stockLocation.id,
        quantity: 100 + i,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.stockMovement.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        stockItemId: stockItem.id,
        delta: stockItem.quantity,
        reason: "initial",
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed completed");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
