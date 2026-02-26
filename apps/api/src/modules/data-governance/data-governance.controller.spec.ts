import { DataGovernanceController } from "./data-governance.controller";

describe("DataGovernanceController", () => {
  it("triggers manual purge", async () => {
    const service = {
      runPurge: jest.fn().mockResolvedValue({ runId: "run-1" }),
    } as unknown;
    const controller = new DataGovernanceController(service);

    const result = await controller.runPurge({ user: { companyId: "co1", sub: "u1" } });
    expect(service.runPurge).toHaveBeenCalledWith("co1", "u1", "manual");
    expect(result.runId).toBe("run-1");
  });

  it("creates legal hold", async () => {
    const service = {
      createLegalHold: jest.fn().mockResolvedValue({ id: "h1" }),
    } as unknown;
    const controller = new DataGovernanceController(service);

    const payload = { customerId: "c1", reason: "legal" } as unknown;
    const result = await controller.createLegalHold({ user: { companyId: "co1", sub: "u1" } }, payload);
    expect(service.createLegalHold).toHaveBeenCalledWith("co1", payload, "u1");
    expect(result.id).toBe("h1");
  });
});
