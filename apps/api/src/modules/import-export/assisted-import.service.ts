import fs from "node:fs";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import type { ImportType } from "./import-export.service";

type Icp = "kiosco" | "distribuidora" | "bebidas";

export type MappingCandidate = {
  sourceHeader: string;
  confidence: number;
  reason: string;
};

export type MappingSuggestion = {
  mapping: Record<string, string | null>;
  fields: Array<{
    field: string;
    required: boolean;
    candidates: MappingCandidate[];
    suggestion: MappingCandidate | null;
  }>;
  unmappedHeaders: string[];
};

export type ImportMappingTemplateRecord = {
  id: string;
  companyId: string;
  type: ImportType;
  icp: string;
  name: string;
  mapping: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
};

const CANONICAL_FIELDS: Record<ImportType, Array<{ name: string; required: boolean }>> = {
  products: [
    { name: "name", required: true },
    { name: "description", required: false },
    { name: "imageUrl", required: false },
    { name: "sku", required: false },
    { name: "barcode", required: false },
    { name: "variantName", required: false },
    { name: "isAlcoholic", required: false },
    { name: "abv", required: false },
  ],
  variants: [
    { name: "productId", required: true },
    { name: "name", required: false },
    { name: "sku", required: true },
    { name: "barcode", required: false },
  ],
  prices: [
    { name: "priceList", required: true },
    { name: "variantSku", required: true },
    { name: "price", required: true },
  ],
  stock: [
    { name: "variantSku", required: true },
    { name: "location", required: true },
    { name: "quantity", required: true },
  ],
  customers: [
    { name: "name", required: true },
    { name: "email", required: false },
    { name: "phone", required: false },
    { name: "line1", required: false },
    { name: "line2", required: false },
    { name: "city", required: false },
    { name: "state", required: false },
    { name: "postalCode", required: false },
    { name: "country", required: false },
  ],
};

const BASE_ALIASES: Record<string, string[]> = {
  name: ["nombre", "producto", "cliente", "razon social", "razon_social"],
  description: ["descripcion", "descripción", "detalle"],
  imageUrl: ["imagen", "foto", "url imagen", "url_imagen", "image", "image url"],
  sku: ["codigo", "código", "cod", "sku variante", "sku_producto"],
  barcode: ["ean", "codigo barras", "código barras", "cod_barra", "gtin", "barcode", "barras"],
  variantName: ["variante", "presentacion", "presentación", "envase", "unidad", "medida"],
  isAlcoholic: ["alcoholico", "alcohólico", "es alcoholico", "es_alcoholico"],
  abv: ["graduacion", "graduación", "abv", "alcohol %", "alc_vol"],
  productId: ["producto id", "id producto", "product_id"],
  priceList: ["lista", "lista precio", "lista_precios", "price list"],
  variantSku: ["sku variante", "variant sku", "sku", "codigo variante"],
  price: ["precio", "importe", "monto"],
  location: ["deposito", "depósito", "sucursal", "almacen", "almacén", "ubicacion", "ubicación"],
  quantity: ["cantidad", "stock", "existencia"],
  email: ["mail", "correo", "correo electronico", "correo electrónico"],
  phone: ["telefono", "teléfono", "celular", "whatsapp"],
  line1: ["direccion", "dirección", "calle", "domicilio", "linea1"],
  line2: ["direccion2", "dirección2", "piso dpto", "linea2"],
  city: ["ciudad", "localidad"],
  state: ["provincia", "estado"],
  postalCode: ["cp", "codigo postal", "código postal", "postal"],
  country: ["pais", "país"],
};

const ICP_ALIASES: Record<Icp, Partial<Record<string, string[]>>> = {
  kiosco: {
    variantName: ["pack", "packaging"],
  },
  distribuidora: {
    priceList: ["lista mayorista", "mayorista", "lista canal"],
    location: ["deposito central", "dep central"],
  },
  bebidas: {
    variantName: ["presentacion ml", "presentacion lt", "botella", "lata", "pack"],
    abv: ["graduacion alcoholica", "graduacion_alcoholica"],
    barcode: ["ean13", "ean_13"],
  },
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string) {
  return normalize(value).split(" ").filter(Boolean);
}

function scoreCandidate(sourceHeader: string, field: string, aliases: string[]) {
  const source = normalize(sourceHeader);
  const canonical = normalize(field);
  if (!source) return { confidence: 0, reason: "empty" };
  if (source === canonical) return { confidence: 1, reason: "exact-field" };
  for (const alias of aliases) {
    const normalizedAlias = normalize(alias);
    if (source === normalizedAlias) return { confidence: 0.98, reason: `exact-alias:${alias}` };
  }
  const sourceTokens = new Set(tokens(sourceHeader));
  const candidates = [field, ...aliases];
  let best = 0;
  let bestReason = "token-overlap";
  for (const candidate of candidates) {
    const ct = tokens(candidate);
    if (ct.length === 0) continue;
    const overlap = ct.filter((t) => sourceTokens.has(t)).length;
    const ratio = overlap / ct.length;
    if (ratio > best) {
      best = ratio;
      bestReason = `token:${candidate}`;
    }
    const sourceJoined = Array.from(sourceTokens).join(" ");
    const candidateNorm = normalize(candidate);
    if (source.includes(candidateNorm) || candidateNorm.includes(source)) {
      best = Math.max(best, 0.72);
      bestReason = `contains:${candidate}`;
    }
    if (sourceJoined && candidateNorm && sourceJoined === candidateNorm.replace(/\b(id|url)\b/g, "").trim()) {
      best = Math.max(best, 0.7);
      bestReason = `near:${candidate}`;
    }
  }
  const confidence = Number(best.toFixed(2));
  return { confidence, reason: bestReason };
}

function getAliases(field: string, icp: string) {
  const base = BASE_ALIASES[field] ?? [];
  const icpAliases = (ICP_ALIASES[(icp as Icp) ?? "kiosco"]?.[field] ?? []) as string[];
  return Array.from(new Set([...base, ...icpAliases]));
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

@Injectable()
export class AssistedImportService {
  private readonly storeFilePath = path.join(process.cwd(), ".data", "import-mapping-templates.json");

  getCanonicalFields(type: ImportType) {
    return CANONICAL_FIELDS[type];
  }

  suggestMapping(type: ImportType, headers: string[], icp: string = "bebidas"): MappingSuggestion {
    const normalizedHeaders = headers.filter(Boolean);
    const available = new Set(normalizedHeaders);
    const picked = new Set<string>();
    const fields = this.getCanonicalFields(type).map((fieldDef) => {
      const candidates = normalizedHeaders
        .map((header) => {
          const { confidence, reason } = scoreCandidate(header, fieldDef.name, getAliases(fieldDef.name, icp));
          return { sourceHeader: header, confidence, reason };
        })
        .filter((c) => c.confidence > 0)
        .sort((a, b) => {
          if (b.confidence !== a.confidence) return b.confidence - a.confidence;
          return a.sourceHeader.localeCompare(b.sourceHeader);
        })
        .slice(0, 5);

      let suggestion: MappingCandidate | null = null;
      for (const candidate of candidates) {
        if (picked.has(candidate.sourceHeader)) continue;
        if (candidate.confidence < 0.45 && fieldDef.required) {
          continue;
        }
        suggestion = candidate;
        picked.add(candidate.sourceHeader);
        break;
      }

      if (!suggestion) {
        const fallback = candidates.find((c) => !picked.has(c.sourceHeader));
        if (fallback && fallback.confidence >= 0.7) {
          suggestion = fallback;
          picked.add(fallback.sourceHeader);
        }
      }

      return {
        field: fieldDef.name,
        required: fieldDef.required,
        candidates,
        suggestion,
      };
    });

    const mapping = Object.fromEntries(fields.map((f) => [f.field, f.suggestion?.sourceHeader ?? null]));
    const mappedHeaders = new Set(Object.values(mapping).filter((v): v is string => Boolean(v)));
    const unmappedHeaders = Array.from(available).filter((h) => !mappedHeaders.has(h));
    return { mapping, fields, unmappedHeaders };
  }

  applyMapping(rows: Record<string, any>[], mapping: Record<string, string | null | undefined>) {
    if (!mapping || Object.keys(mapping).length === 0) return rows;
    return rows.map((row) => {
      const mapped: Record<string, any> = {};
      for (const [field, sourceHeader] of Object.entries(mapping)) {
        if (!sourceHeader) continue;
        mapped[field] = row[sourceHeader];
      }
      return mapped;
    });
  }

  listTemplates(companyId: string, type?: ImportType, icp?: string) {
    const items = this.readAll().filter((item) => item.companyId === companyId);
    return items
      .filter((item) => (type ? item.type === type : true))
      .filter((item) => (icp ? item.icp === icp : true))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        if (a.icp !== b.icp) return a.icp.localeCompare(b.icp);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }

  upsertTemplate(params: {
    companyId: string;
    type: ImportType;
    icp: string;
    name: string;
    mapping: Record<string, string | null>;
  }) {
    const all = this.readAll();
    const now = new Date().toISOString();
    const existing = all.find(
      (item) =>
        item.companyId === params.companyId &&
        item.type === params.type &&
        item.icp === params.icp &&
        normalize(item.name) === normalize(params.name),
    );
    if (existing) {
      existing.mapping = params.mapping;
      existing.updatedAt = now;
      this.writeAll(all);
      return existing;
    }
    const created: ImportMappingTemplateRecord = {
      id: `imt_${Math.random().toString(36).slice(2, 10)}`,
      companyId: params.companyId,
      type: params.type,
      icp: params.icp,
      name: params.name,
      mapping: params.mapping,
      createdAt: now,
      updatedAt: now,
    };
    all.push(created);
    this.writeAll(all);
    return created;
  }

  deleteTemplate(companyId: string, id: string) {
    const all = this.readAll();
    const next = all.filter((item) => !(item.companyId === companyId && item.id === id));
    const deleted = next.length !== all.length;
    if (deleted) {
      this.writeAll(next);
    }
    return deleted;
  }

  private readAll(): ImportMappingTemplateRecord[] {
    try {
      if (!fs.existsSync(this.storeFilePath)) return [];
      const raw = fs.readFileSync(this.storeFilePath, "utf8");
      const parsed = safeJsonParse<ImportMappingTemplateRecord[]>(raw, []);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeAll(items: ImportMappingTemplateRecord[]) {
    const dir = path.dirname(this.storeFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storeFilePath, JSON.stringify(items, null, 2), "utf8");
  }
}

