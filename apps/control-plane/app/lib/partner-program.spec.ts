import {
  calculateCommissionIncrement,
  detectBasicLeadFraud,
  resolveAttributionForAccountCreation,
} from "./partner-program";

describe("PartnerProgram", () => {
  it("resolves attribution from cookie + UTM for account creation", () => {
    const result = resolveAttributionForAccountCreation({
      cookie: {
        leadId: "lead_1",
        partnerSlug: "partner-a",
        referralCode: "ref-a",
        utmSource: "instagram",
      },
      utm: {
        utmCampaign: "summer",
      },
    });

    expect(result.hasAttribution).toBe(true);
    expect(result.source).toBe("cookie+utm");
    expect(result.leadId).toBe("lead_1");
    expect(result.referralCode).toBe("ref-a");
    expect(result.utmSource).toBe("instagram");
    expect(result.utmCampaign).toBe("summer");
  });

  it("flags basic same-domain and same-ip fraud", () => {
    const fraud = detectBasicLeadFraud({
      partnerWebsiteDomain: "partner.com",
      clickIp: "1.2.3.4",
      accountIp: "1.2.3.4",
      accountEmail: "owner@partner.com",
      installationDomain: "partner.com",
    });

    expect(fraud.flags).toContain("same_ip");
    expect(fraud.flags).toContain("same_domain_email");
    expect(fraud.flags).toContain("same_domain_site");
    expect(fraud.score).toBeGreaterThanOrEqual(80);
  });

  it("calculates commission estimate for percent and hybrid plans", () => {
    const percentFirst = calculateCommissionIncrement({
      plan: { type: "PERCENT_REVENUE", percentRate: 10 },
      invoiceAmount: 10000,
      invoiceIndex: 1,
    });
    const hybridFirst = calculateCommissionIncrement({
      plan: { type: "HYBRID", percentRate: 5, flatAmount: 1000 },
      invoiceAmount: 10000,
      invoiceIndex: 1,
    });
    const hybridSecond = calculateCommissionIncrement({
      plan: { type: "HYBRID", percentRate: 5, flatAmount: 1000 },
      invoiceAmount: 10000,
      invoiceIndex: 2,
    });

    expect(percentFirst).toBe(1000);
    expect(hybridFirst).toBe(1500);
    expect(hybridSecond).toBe(500);
  });
});

