import { Test } from "@nestjs/testing";
import request from "supertest";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { EdgeCacheHeaders } from "../edge-cache/edge-cache.types";

describe("CatalogController cache headers", () => {
  it("sets cache headers on categories", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: {
            listCategories: jest.fn().mockResolvedValue({ items: [] }),
            listProducts: jest.fn(),
            getProduct: jest.fn(),
            syncCart: jest.fn(),
          },
        },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer()).get("/catalog/categories");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe(EdgeCacheHeaders.catalog);

    await app.close();
  });
});
