type JsonLike = Record<string, unknown>;

type CrmLeadRecord = {
  id: string;
  email: string;
  companyName: string | null;
  businessType: string | null;
  city: string | null;
};

type CrmDealRecord = {
  id: string;
  stage: "NEW" | "CONTACTED" | "DEMO" | "TRIAL" | "NEGOTIATION" | "WON" | "LOST";
};

type PrismaCrmLeadDelegate = {
  findFirst(args: {
    where: { trialRedemptionId?: string; email?: string };
    orderBy?: { createdAt: "desc" | "asc" };
  }): Promise<CrmLeadRecord | null>;
  create(args: {
    data: {
      installationId: string | null;
      instanceId: string | null;
      companyId: string | null;
      leadAttributionId: string | null;
      trialCampaignId: string | null;
      trialRedemptionId: string | null;
      email: string;
      companyName: string | null;
      city: string | null;
      businessType: string | null;
      source: string;
      metadata?: JsonLike;
    };
  }): Promise<CrmLeadRecord>;
  update(args: {
    where: { id: string };
    data: {
      installationId?: string | null;
      instanceId?: string | null;
      companyId?: string | null;
      leadAttributionId?: string | null;
      trialCampaignId?: string | null;
      trialRedemptionId?: string | null;
      companyName?: string | null;
      city?: string | null;
      businessType?: string | null;
      metadata?: JsonLike;
    };
  }): Promise<CrmLeadRecord>;
};

type PrismaCrmDealDelegate = {
  findFirst(args: {
    where: { sourceTrialRedemptionId?: string; leadId?: string };
    orderBy?: { createdAt: "desc" | "asc" };
  }): Promise<CrmDealRecord | null>;
  create(args: {
    data: {
      leadId: string;
      installationId: string | null;
      instanceId: string | null;
      companyId: string | null;
      billingAccountId: string | null;
      sourceTrialCampaignId: string | null;
      sourceTrialRedemptionId: string | null;
      title: string;
      stage: "TRIAL";
      source: string;
      tags: string[];
      metadata?: JsonLike;
    };
  }): Promise<CrmDealRecord>;
  update(args: {
    where: { id: string };
    data: {
      leadId?: string;
      installationId?: string | null;
      instanceId?: string | null;
      companyId?: string | null;
      billingAccountId?: string | null;
      sourceTrialCampaignId?: string | null;
      sourceTrialRedemptionId?: string | null;
      title?: string;
      stage?: "TRIAL";
      tags?: string[];
      metadata?: JsonLike;
    };
  }): Promise<CrmDealRecord>;
};

type PrismaCrmDealStageTransitionDelegate = {
  create(args: {
    data: {
      dealId: string;
      fromStage: CrmDealRecord["stage"] | null;
      toStage: "TRIAL";
      reason: string;
      changedBy: string;
    };
  }): Promise<unknown>;
};

type PrismaCrmLike = {
  crmLead: PrismaCrmLeadDelegate;
  crmDeal: PrismaCrmDealDelegate;
  crmDealStageTransition: PrismaCrmDealStageTransitionDelegate;
};

export type TrialSignupCrmInput = {
  campaignId: string;
  redemptionId: string;
  installationId: string;
  instanceId: string;
  companyId: string | null;
  billingAccountId: string | null;
  leadAttributionId: string;
  email: string | null;
  businessType: string | null;
  city: string | null;
  companyName: string | null;
};

function buildTags(input: TrialSignupCrmInput): string[] {
  const tags = new Set<string>(["trial"]);
  if (input.businessType) {
    tags.add(String(input.businessType).toLowerCase());
  }
  return [...tags];
}

function buildTitle(input: TrialSignupCrmInput): string {
  const company = input.companyName?.trim() || input.email?.trim() || input.instanceId;
  return `Trial - ${company}`;
}

export async function upsertCrmDealFromTrialSignup(prisma: PrismaCrmLike, input: TrialSignupCrmInput): Promise<void> {
  if (!input.email) return;

  const metadata: JsonLike = {
    source: "trial_signup",
    leadAttributionId: input.leadAttributionId,
    trialCampaignId: input.campaignId,
    trialRedemptionId: input.redemptionId,
  };

  const existingLead =
    (await prisma.crmLead.findFirst({
      where: { trialRedemptionId: input.redemptionId },
      orderBy: { createdAt: "desc" },
    })) ??
    (await prisma.crmLead.findFirst({
      where: { email: input.email },
      orderBy: { createdAt: "desc" },
    }));

  const lead = existingLead
    ? await prisma.crmLead.update({
        where: { id: existingLead.id },
        data: {
          installationId: input.installationId,
          instanceId: input.instanceId,
          companyId: input.companyId,
          leadAttributionId: input.leadAttributionId,
          trialCampaignId: input.campaignId,
          trialRedemptionId: input.redemptionId,
          companyName: input.companyName,
          city: input.city,
          businessType: input.businessType,
          metadata,
        },
      })
    : await prisma.crmLead.create({
        data: {
          installationId: input.installationId,
          instanceId: input.instanceId,
          companyId: input.companyId,
          leadAttributionId: input.leadAttributionId,
          trialCampaignId: input.campaignId,
          trialRedemptionId: input.redemptionId,
          email: input.email,
          companyName: input.companyName,
          city: input.city,
          businessType: input.businessType,
          source: "trial_campaign",
          metadata,
        },
      });

  const existingDeal = await prisma.crmDeal.findFirst({
    where: { sourceTrialRedemptionId: input.redemptionId },
    orderBy: { createdAt: "desc" },
  });

  const dealTitle = buildTitle(input);
  const tags = buildTags(input);

  if (existingDeal) {
    const previousStage = existingDeal.stage;
    const updatedDeal = await prisma.crmDeal.update({
      where: { id: existingDeal.id },
      data: {
        leadId: lead.id,
        installationId: input.installationId,
        instanceId: input.instanceId,
        companyId: input.companyId,
        billingAccountId: input.billingAccountId,
        sourceTrialCampaignId: input.campaignId,
        sourceTrialRedemptionId: input.redemptionId,
        title: dealTitle,
        stage: "TRIAL",
        tags,
        metadata,
      },
    });
    if (previousStage !== "TRIAL") {
      await prisma.crmDealStageTransition.create({
        data: {
          dealId: updatedDeal.id,
          fromStage: previousStage,
          toStage: "TRIAL",
          reason: "Trial signup redeemed",
          changedBy: "system:trial-signup",
        },
      });
    }
    return;
  }

  const deal = await prisma.crmDeal.create({
    data: {
      leadId: lead.id,
      installationId: input.installationId,
      instanceId: input.instanceId,
      companyId: input.companyId,
      billingAccountId: input.billingAccountId,
      sourceTrialCampaignId: input.campaignId,
      sourceTrialRedemptionId: input.redemptionId,
      title: dealTitle,
      stage: "TRIAL",
      source: "trial_campaign",
      tags,
      metadata,
    },
  });

  await prisma.crmDealStageTransition.create({
    data: {
      dealId: deal.id,
      fromStage: null,
      toStage: "TRIAL",
      reason: "Trial signup redeemed",
      changedBy: "system:trial-signup",
    },
  });
}
