import { GovernanceEntity } from "@erp/db";
import { normalizeGovernancePlan, resolveEffectivePolicy } from "./retention-policy-resolver";

describe("retention-policy-resolver", () => {
  it("falls back unknown plan to pro", () => {
    expect(normalizeGovernancePlan("unknown")).toBe("pro");
  });

  it("uses override over defaults", () => {
    const resolved = resolveEffectivePolicy("starter", [
      { entity: GovernanceEntity.ORDERS, retentionDays: 999 },
    ]);
    expect(resolved.find((row) => row.entity === GovernanceEntity.ORDERS)?.retentionDays).toBe(999);
    expect(resolved.find((row) => row.entity === GovernanceEntity.ORDERS)?.source).toBe("override");
  });
});
