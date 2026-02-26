import { ArcaReadinessService, validateCuit } from "./arca-readiness.service";

describe("ArcaReadinessService", () => {
  const prismaMock = {
    company: { findUnique: jest.fn(), findFirst: jest.fn() },
    companySettings: { findUnique: jest.fn() },
    secret: { findUnique: jest.fn() },
    afipLog: { create: jest.fn() },
  };
  const secretsMock = { getSecret: jest.fn() };
  const auditMock = { append: jest.fn() };
  const pdfMock = { renderPdf: jest.fn() };
  const storageMock = { put: jest.fn(), signedUrl: jest.fn() };

  class TestService extends ArcaReadinessService {
    certResult: unknown = {
      ok: true,
      source: "pem",
      certPresent: true,
      keyPresent: true,
      certValid: true,
      keyValid: true,
      fingerprint256: "AA:BB",
      issuer: "CN=ARCA TEST",
      subject: "CN=Demo",
      validFrom: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      validTo: new Date("2026-12-31T00:00:00.000Z").toISOString(),
      expiresInDays: 200,
      errors: [],
    };
    wsaaToken: unknown = { token: "tok", sign: "sig", generatedAt: new Date("2026-02-26T10:00:00.000Z") };
    wsfeResults: Array<unknown> = [];

    protected override inspectCertificateMaterial() {
      return this.certResult;
    }
    protected override createWsaa() {
      return { getToken: jest.fn().mockResolvedValue(this.wsaaToken) };
    }
    protected override createWsfe() {
      let idx = 0;
      return {
        requestCae: jest.fn().mockImplementation(async (payload: unknown) => {
          const row = this.wsfeResults[idx++] ?? { cae: `CAE-${payload.type}-${payload.number}`, caeDue: new Date("2026-03-10T00:00:00.000Z"), result: "A", raw: payload };
          if (row instanceof Error) throw row;
          return row;
        }),
      };
    }
  }

  function buildService() {
    return new TestService(prismaMock as never as never, secretsMock as never, auditMock as never, pdfMock as never, storageMock as never);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-26T12:00:00.000Z"));
    prismaMock.company.findUnique.mockReset();
    prismaMock.company.findFirst.mockReset();
    prismaMock.companySettings.findUnique.mockReset();
    prismaMock.secret.findUnique.mockReset();
    prismaMock.afipLog.create.mockReset();
    secretsMock.getSecret.mockReset();
    auditMock.append.mockReset();
    pdfMock.renderPdf.mockReset();
    storageMock.put.mockReset();
    storageMock.signedUrl.mockReset();

    prismaMock.company.findUnique.mockResolvedValue({ id: "c1", name: "Demo" });
    prismaMock.company.findFirst.mockResolvedValue({ id: "c1", name: "Demo" });
    prismaMock.companySettings.findUnique.mockResolvedValue({
      companyId: "c1",
      billingMode: "AFIP",
      enableAfip: true,
      afipCuit: "20329642330",
      afipPointOfSale: 3,
      afipEnvironment: "HOMO",
      afipCertIssuer: "ARCA AC",
    });
    prismaMock.secret.findUnique.mockResolvedValue({ id: "sec1", status: "ACTIVE", verifiedAt: new Date("2026-02-01T00:00:00.000Z"), expiresAt: null, meta: {} });
    secretsMock.getSecret.mockResolvedValue({ certPem: "---CERT---", keyPem: "---KEY---" });
    pdfMock.renderPdf.mockResolvedValue(Buffer.from("pdf"));
    storageMock.put.mockResolvedValue(undefined);
    storageMock.signedUrl.mockResolvedValue("http://signed-url/report.pdf");
    process.env.AFIP_SANDBOX = "true";
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("validates CUIT checksum", () => {
    expect(validateCuit("20329642330").ok).toBe(true);
    expect(validateCuit("30712345679").ok).toBe(false);
    expect(validateCuit("20-1").reason).toBe("length");
  });

  it("builds readiness checklist with warnings/failures", async () => {
    const service = buildService();
    service.certResult = {
      ok: false,
      source: "pem",
      certPresent: true,
      keyPresent: false,
      certValid: false,
      keyValid: false,
      errors: ["cert_invalid_format", "key_missing"],
      expiresInDays: null,
    };
    prismaMock.companySettings.findUnique.mockResolvedValueOnce({
      companyId: "c1",
      billingMode: "NO_FISCAL",
      enableAfip: false,
      afipCuit: "30712345679",
      afipPointOfSale: null,
      afipEnvironment: "???",
      afipCertIssuer: null,
    });

    const checklist = await service.getChecklist({ companyId: "c1", invoiceTypes: [] });
    expect(checklist.summary.readiness).toBe("NOT_READY");
    expect(checklist.items.find((i) => i.key === "billing_mode")?.status).toBe("FAIL");
    expect(checklist.items.find((i) => i.key === "cuit")?.status).toBe("FAIL");
    expect(checklist.items.find((i) => i.key === "certificates")?.status).toBe("FAIL");
    expect(checklist.items.find((i) => i.key === "comprobante_types")?.status).toBe("WARN");
  });

  it("runs dry-run in homologation and logs results", async () => {
    const service = buildService();
    service.wsfeResults = [
      { cae: "CAE-B-1", caeDue: new Date("2026-03-05T00:00:00.000Z"), result: "A", raw: { test: 1 } },
      new Error("wsfe_case_failure"),
    ];

    const result = await service.runDryRun("c1", "u1", { invoiceTypes: ["B", "C"], amountArs: 500.25, pointOfSale: 4 });

    expect(result.mode).toBe("HOMO");
    expect(result.ok).toBe(false);
    expect(result.cases).toHaveLength(2);
    expect(result.cases[0]).toEqual(expect.objectContaining({ type: "B", ok: true, cae: "CAE-B-1" }));
    expect(result.cases[1]).toEqual(expect.objectContaining({ type: "C", ok: false, error: "wsfe_case_failure" }));
    expect(prismaMock.afipLog.create).toHaveBeenCalled();
    expect(auditMock.append).toHaveBeenCalledWith(expect.objectContaining({ action: "billing.arca.readiness.dry_run" }));
  });

  it("generates signed readiness report pdf", async () => {
    const service = buildService();

    const report = await service.generateReport("c1", "u1", { invoiceTypes: ["B"], includeDryRun: true });

    expect(report.ok).toBe(true);
    expect(report.signatureAlgorithm).toBe("HMAC-SHA256");
    expect(report.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(report.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storageMock.put).toHaveBeenCalledTimes(1);
    expect(storageMock.signedUrl).toHaveBeenCalledTimes(1);
    expect(auditMock.append).toHaveBeenCalledWith(expect.objectContaining({ action: "billing.arca.readiness.report" }));
  });
});
