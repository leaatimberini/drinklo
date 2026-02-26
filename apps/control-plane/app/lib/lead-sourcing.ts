import { hashEvidencePayload } from "./compliance-evidence";

type AnyPrisma = any;

export type LeadSourcingParsedRow = {
  rowNumber: number;
  empresa: string;
  rubro: string;
  ciudad: string;
  contacto: string;
  canal: string;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  raw: Record<string, string>;
};

export type LeadSourcingEnrichedRow = LeadSourcingParsedRow & {
  dedupeKey: string;
  tags: string[];
  icpTags: string[];
  potentialScore: number;
  potentialBand: "LOW" | "MEDIUM" | "HIGH";
  recommendedStage: "NEW" | "CONTACTED" | "DEMO";
  recommendedTasks: string[];
  warnings: string[];
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slugLike(value: unknown) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out.map((v) => v.replace(/^"|"$/g, ""));
}

export function parseLeadCsv(csv: string) {
  const lines = String(csv ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  if (!lines.length) {
    return { headers: [] as string[], rows: [] as Record<string, string>[] };
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = String(values[i] ?? "").trim();
    });
    return row;
  });
  return { headers, rows };
}

function getColumnValue(row: Record<string, string>, aliases: string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    const found = entries.find(([key]) => normalizeText(key) === normalizedAlias);
    if (found && String(found[1] ?? "").trim()) return String(found[1]).trim();
  }
  return "";
}

function parseContact(contacto: string, row: Record<string, string>) {
  const explicitEmail = getColumnValue(row, ["email", "correo", "mail"]);
  const explicitPhone = getColumnValue(row, ["telefono", "tel", "celular", "whatsapp", "phone"]);
  const explicitName = getColumnValue(row, ["nombre contacto", "contact_name", "contacto_nombre"]);
  const raw = String(contacto ?? "").trim();

  const emailMatch = (explicitEmail || raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneCandidate = explicitPhone || raw;
  const digits = phoneCandidate.replace(/\D/g, "");
  const phone = digits.length >= 8 ? phoneCandidate : null;
  let contactName = explicitName || null;
  if (!contactName && raw && !emailMatch && digits.length < 8) {
    contactName = raw;
  }
  return {
    email: emailMatch ? emailMatch[0].toLowerCase() : null,
    phone,
    contactName,
  };
}

export function mapLeadSourcingRows(rows: Record<string, string>[]) {
  return rows.map((row, idx): LeadSourcingParsedRow => {
    const empresa = getColumnValue(row, ["empresa", "company", "companyName", "razon social", "comercio"]);
    const rubro = getColumnValue(row, ["rubro", "segmento", "businessType", "vertical"]);
    const ciudad = getColumnValue(row, ["ciudad", "city", "localidad"]);
    const contacto = getColumnValue(row, ["contacto", "contact", "responsable", "email", "telefono"]);
    const canal = getColumnValue(row, ["canal", "channel", "origen", "source"]);
    const contactParsed = parseContact(contacto, row);

    return {
      rowNumber: idx + 2,
      empresa,
      rubro,
      ciudad,
      contacto,
      canal,
      email: contactParsed.email,
      phone: contactParsed.phone,
      contactName: contactParsed.contactName,
      raw: row,
    };
  });
}

function inferIcpTags(row: LeadSourcingParsedRow) {
  const text = [row.rubro, row.canal, row.empresa].map(normalizeText).join(" ");
  const tags = new Set<string>(["bebidas"]);
  if (/distrib|mayorista/.test(text)) tags.add("icp:distribuidora");
  if (/kiosco|almacen|almac[eé]n|minimarket/.test(text)) tags.add("icp:kiosco");
  if (/\bbar\b|cerveceria|cervecer[ií]a|resto|gastr/.test(text)) tags.add("icp:bar");
  if (/enterprise|cadena|franquicia|multi\s?sucursal/.test(text)) tags.add("icp:enterprise");
  if (!Array.from(tags).some((t) => t.startsWith("icp:"))) tags.add("icp:kiosco");
  return Array.from(tags);
}

function scorePotential(row: LeadSourcingParsedRow, icpTags: string[]) {
  let score = 0;
  const warnings: string[] = [];
  if (row.empresa) score += 20;
  else warnings.push("empresa_missing");
  if (row.email) score += 20;
  if (row.phone) score += 10;
  if (!row.email && !row.phone) warnings.push("contact_missing");
  if (row.ciudad) score += 10;
  else warnings.push("city_missing");
  if (row.canal) score += 10;
  if (row.rubro) score += 10;

  if (icpTags.includes("icp:distribuidora")) score += 15;
  if (icpTags.includes("icp:enterprise")) score += 20;
  if (/referido|partner|inbound|webinar|evento/i.test(row.canal)) score += 10;
  if (/outbound|scraping|cold/i.test(row.canal)) score -= 5;

  score = Math.max(0, Math.min(100, score));
  const band: LeadSourcingEnrichedRow["potentialBand"] = score >= 75 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
  const recommendedStage: "NEW" | "CONTACTED" | "DEMO" =
    band === "HIGH" && (row.email || row.phone) ? "DEMO" : band !== "LOW" && (row.email || row.phone) ? "CONTACTED" : "NEW";
  return { score, band, recommendedStage, warnings };
}

function buildRecommendedTasks(row: LeadSourcingParsedRow, score: number, icpTags: string[]) {
  const tasks = ["Agendar demo"];
  if (score >= 60) tasks.push("Crear trial");
  if (score >= 75 || icpTags.includes("icp:enterprise")) tasks.push("Enviar pack seguridad");
  return tasks;
}

export function enrichLeadSourcingRows(rows: LeadSourcingParsedRow[]): LeadSourcingEnrichedRow[] {
  return rows.map((row) => {
    const icpTags = inferIcpTags(row);
    const scored = scorePotential(row, icpTags);
    const tags = Array.from(
      new Set([
        ...icpTags,
        row.canal ? `canal:${slugLike(row.canal)}` : "",
        row.ciudad ? `ciudad:${slugLike(row.ciudad)}` : "",
        row.rubro ? `rubro:${slugLike(row.rubro)}` : "",
        `potential:${scored.band.toLowerCase()}`,
        "source:lead-sourcing",
      ].filter(Boolean)),
    );
    const dedupeKey = row.email
      ? `email:${row.email}`
      : `company-city:${slugLike(row.empresa)}:${slugLike(row.ciudad || "na")}`;
    return {
      ...row,
      dedupeKey,
      tags,
      icpTags,
      potentialScore: scored.score,
      potentialBand: scored.band,
      recommendedStage: scored.recommendedStage,
      recommendedTasks: buildRecommendedTasks(row, scored.score, icpTags),
      warnings: scored.warnings,
    };
  });
}

export async function applyLeadSourcingImport(
  prisma: AnyPrisma,
  input: {
    actor: string;
    rows: LeadSourcingEnrichedRow[];
    dryRun?: boolean;
  },
) {
  const rows = input.rows;
  const emails = rows.map((r) => r.email).filter(Boolean) as string[];
  const companyNames = rows.map((r) => r.empresa).filter(Boolean);

  const [existingLeadsByEmail, existingLeadsByCompany] = await Promise.all([
    emails.length
      ? prisma.crmLead.findMany({
          where: { email: { in: emails } },
          include: { deals: { orderBy: { updatedAt: "desc" }, take: 5 } },
        })
      : [],
    companyNames.length
      ? prisma.crmLead.findMany({
          where: { companyName: { in: companyNames } },
          include: { deals: { orderBy: { updatedAt: "desc" }, take: 5 } },
        })
      : [],
  ]);

  const byEmail = new Map<string, any>((existingLeadsByEmail ?? []).map((l: any) => [String(l.email).toLowerCase(), l]));
  const byCompanyCity = new Map<string, any>(
    (existingLeadsByCompany ?? []).map((l: any) => [
      `company-city:${slugLike(l.companyName || "")}:${slugLike(l.city || "na")}`,
      l,
    ]),
  );

  const summary = {
    totalRows: rows.length,
    validRows: 0,
    duplicatesDetected: 0,
    leadsCreated: 0,
    leadsUpdated: 0,
    dealsCreated: 0,
    dealsUpdated: 0,
    tasksCreated: 0,
    skippedRows: 0,
    errors: [] as Array<{ rowNumber: number; message: string }>,
  };

  const preview = [] as Array<{
    rowNumber: number;
    action: "create" | "update" | "skip";
    company: string;
    dedupeKey: string;
    score: number;
    stage: string;
    tasks: string[];
  }>;

  const dedupeSeen = new Set<string>();

  const applyRow = async (tx: AnyPrisma, row: LeadSourcingEnrichedRow) => {
    if (!row.empresa) {
      summary.skippedRows += 1;
      summary.errors.push({ rowNumber: row.rowNumber, message: "empresa_missing" });
      preview.push({
        rowNumber: row.rowNumber,
        action: "skip",
        company: row.empresa || "(sin empresa)",
        dedupeKey: row.dedupeKey,
        score: row.potentialScore,
        stage: row.recommendedStage,
        tasks: [],
      });
      return;
    }

    if (dedupeSeen.has(row.dedupeKey)) {
      summary.duplicatesDetected += 1;
      preview.push({
        rowNumber: row.rowNumber,
        action: "skip",
        company: row.empresa,
        dedupeKey: row.dedupeKey,
        score: row.potentialScore,
        stage: row.recommendedStage,
        tasks: [],
      });
      return;
    }
    dedupeSeen.add(row.dedupeKey);
    summary.validRows += 1;

    const existingLead = row.email ? byEmail.get(row.email) : byCompanyCity.get(row.dedupeKey);
    const action: "create" | "update" = existingLead ? "update" : "create";
    let lead = existingLead;

    if (action === "create") {
      lead = await tx.crmLead.create({
        data: {
          email: row.email ?? `unknown+${slugLike(row.empresa)}-${row.rowNumber}@lead.local`,
          name: row.contactName ?? null,
          companyName: row.empresa,
          phone: row.phone,
          city: row.ciudad || null,
          businessType: row.rubro || null,
          source: "lead_sourcing_import",
          tags: row.tags,
          status: "ACTIVE",
          nextActionAt: new Date(),
          metadata: {
            leadSourcing: {
              canal: row.canal || null,
              contactoRaw: row.contacto || null,
              score: row.potentialScore,
              scoreBand: row.potentialBand,
              warnings: row.warnings,
              importedAt: new Date().toISOString(),
            },
          },
        },
        include: { deals: { orderBy: { updatedAt: "desc" }, take: 5 } },
      });
      summary.leadsCreated += 1;
      if (lead.email) byEmail.set(String(lead.email).toLowerCase(), lead);
      byCompanyCity.set(`company-city:${slugLike(lead.companyName || "")}:${slugLike(lead.city || "na")}`, lead);
    } else {
      lead = await tx.crmLead.update({
        where: { id: existingLead.id },
        data: {
          name: existingLead.name || row.contactName || undefined,
          companyName: existingLead.companyName || row.empresa || undefined,
          phone: existingLead.phone || row.phone || undefined,
          city: existingLead.city || row.ciudad || undefined,
          businessType: existingLead.businessType || row.rubro || undefined,
          tags: Array.from(new Set([...(existingLead.tags ?? []), ...row.tags])),
          nextActionAt: existingLead.nextActionAt ?? new Date(),
          metadata: {
            ...(existingLead.metadata ?? {}),
            leadSourcing: {
              canal: row.canal || null,
              contactoRaw: row.contacto || null,
              score: row.potentialScore,
              scoreBand: row.potentialBand,
              warnings: row.warnings,
              importedAt: new Date().toISOString(),
              lastImportRowNumber: row.rowNumber,
            },
          },
        },
        include: { deals: { orderBy: { updatedAt: "desc" }, take: 5 } },
      });
      summary.leadsUpdated += 1;
    }

    let deal = (lead.deals ?? [])[0] ?? null;
    if (!deal) {
      deal = await tx.crmDeal.create({
        data: {
          leadId: lead.id,
          title: `Lead ${lead.companyName ?? lead.email}`,
          stage: row.recommendedStage,
          source: "lead_sourcing_import",
          nextActionAt: new Date(),
          tags: Array.from(new Set([...(lead.tags ?? []), "lead-sourcing"])),
          metadata: {
            leadSourcing: {
              canal: row.canal || null,
              score: row.potentialScore,
              scoreBand: row.potentialBand,
              importedBy: input.actor,
            },
          },
          transitions: {
            create: {
              fromStage: null,
              toStage: row.recommendedStage,
              reason: "lead_sourcing_import",
              changedBy: input.actor,
            },
          },
        },
      });
      summary.dealsCreated += 1;
    } else {
      const nextTags = Array.from(new Set([...(deal.tags ?? []), ...row.tags, "lead-sourcing"]));
      const updateData: Record<string, any> = {
        tags: nextTags,
        nextActionAt: deal.nextActionAt ?? new Date(),
      };
      let transitioned = false;
      if (deal.stage === "NEW" && (row.recommendedStage === "CONTACTED" || row.recommendedStage === "DEMO")) {
        updateData.stage = row.recommendedStage === "DEMO" ? "CONTACTED" : row.recommendedStage;
        transitioned = Boolean(updateData.stage && updateData.stage !== deal.stage);
      }
      deal = await tx.crmDeal.update({ where: { id: deal.id }, data: updateData });
      if (transitioned) {
        await tx.crmDealStageTransition.create({
          data: {
            dealId: deal.id,
            fromStage: "NEW",
            toStage: updateData.stage,
            reason: "lead_sourcing_enrichment",
            changedBy: input.actor,
          },
        });
      }
      summary.dealsUpdated += 1;
    }

    const existingTasks = await tx.crmDealTask.findMany({
      where: { dealId: deal.id, doneAt: null },
      select: { title: true },
    });
    const existingTaskTitles = new Set(existingTasks.map((t: any) => String(t.title).toLowerCase()));
    for (const taskTitle of row.recommendedTasks) {
      if (existingTaskTitles.has(taskTitle.toLowerCase())) continue;
      await tx.crmDealTask.create({
        data: {
          dealId: deal.id,
          title: taskTitle,
          dueAt: new Date(Date.now() + (taskTitle === "Agendar demo" ? 2 : 3) * 24 * 60 * 60 * 1000),
          createdBy: input.actor,
        },
      });
      existingTaskTitles.add(taskTitle.toLowerCase());
      summary.tasksCreated += 1;
    }

    preview.push({
      rowNumber: row.rowNumber,
      action,
      company: row.empresa,
      dedupeKey: row.dedupeKey,
      score: row.potentialScore,
      stage: row.recommendedStage,
      tasks: row.recommendedTasks,
    });
  };

  if (input.dryRun) {
    for (const row of rows) {
      await applyRow(
        {
          crmLead: {
            create: async ({ data }: any) => ({ id: `dry-lead-${row.rowNumber}`, ...data, deals: [] }),
            update: async ({ where, data }: any) => ({ id: where.id, ...data, deals: [] }),
          },
          crmDeal: {
            create: async ({ data }: any) => ({ id: `dry-deal-${row.rowNumber}`, ...data }),
            update: async ({ where, data }: any) => ({ id: where.id, ...data }),
          },
          crmDealStageTransition: { create: async () => ({}) },
          crmDealTask: {
            findMany: async () => [],
            create: async () => ({}),
          },
        } as any,
        row,
      );
    }
  } else {
    await prisma.$transaction(async (tx: AnyPrisma) => {
      for (const row of rows) {
        await applyRow(tx, row);
      }
    });

    const evidencePayload = {
      kind: "lead_sourcing_import",
      importedAt: new Date().toISOString(),
      actor: input.actor,
      summary,
      preview: preview.slice(0, 50),
    };
    await prisma.complianceEvidence.create({
      data: {
        installationId: null,
        evidenceType: "lead_sourcing_import",
        source: "control-plane",
        payload: evidencePayload,
        payloadHash: hashEvidencePayload(evidencePayload),
        sourceCapturedAt: new Date(),
        capturedBy: input.actor,
        tags: ["marketing", "lead-sourcing", "crm"],
      },
    });
  }

  return { summary, preview };
}

export function parseAndEnrichLeadSourcingCsv(csv: string) {
  const parsed = parseLeadCsv(csv);
  const mapped = mapLeadSourcingRows(parsed.rows);
  const enriched = enrichLeadSourcingRows(mapped);
  const summary = {
    totalRows: enriched.length,
    validCompanyRows: enriched.filter((r) => Boolean(r.empresa)).length,
    withEmail: enriched.filter((r) => Boolean(r.email)).length,
    withPhone: enriched.filter((r) => Boolean(r.phone)).length,
    highPotential: enriched.filter((r) => r.potentialBand === "HIGH").length,
    mediumPotential: enriched.filter((r) => r.potentialBand === "MEDIUM").length,
    lowPotential: enriched.filter((r) => r.potentialBand === "LOW").length,
  };
  return { ...parsed, mapped, enriched, summary };
}
