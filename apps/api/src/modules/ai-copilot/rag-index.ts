import fs from "node:fs";
import path from "node:path";

export type RagScope =
  | "docs.general"
  | "docs.runbooks"
  | "docs.security"
  | "docs.operations"
  | "kb.instance.incidents";

export type RagChunk = {
  docId: string;
  section: string;
  content: string;
  sourceType: "doc" | "runbook" | "instance_kb";
  language?: "es" | "en" | "mixed";
  scope: RagScope;
  companyId?: string;
  scoreBoost?: number;
};

let staticCache: { builtAt: number; chunks: RagChunk[] } | null = null;

export function buildStaticDocsRagIndex(): RagChunk[] {
  if (staticCache && Date.now() - staticCache.builtAt < 5 * 60 * 1000) {
    return staticCache.chunks;
  }

  const docsDir = resolveDocsDir();
  if (!docsDir) return [];

  const files = fs
    .readdirSync(docsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name);

  const chunks: RagChunk[] = [];
  for (const file of files) {
    const abs = path.join(docsDir, file);
    let content = "";
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    chunks.push(...markdownToChunks(file, content));
  }

  staticCache = { builtAt: Date.now(), chunks };
  return chunks;
}

export function searchRagChunks(chunks: RagChunk[], query: string, limit = 5) {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) {
    return chunks.slice(0, limit).map((chunk) => ({ chunk, score: 0 }));
  }

  const scored = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, qTokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

export function filterChunksByAccess(chunks: RagChunk[], user: { role: string; permissions: string[] }, mode: string) {
  const perms = new Set((user.permissions ?? []).map((p) => String(p)));
  const role = String(user.role ?? "").toLowerCase();
  const incidentMode = String(mode ?? "").toLowerCase().includes("incident");

  return chunks.filter((chunk) => {
    if (chunk.scope === "docs.general") return true;
    if (chunk.scope === "docs.operations") return perms.has("products:read");
    if (chunk.scope === "docs.runbooks") {
      return incidentMode && (role === "admin" || role === "support" || perms.has("settings:write"));
    }
    if (chunk.scope === "docs.security") {
      return role === "admin" || role === "support" || perms.has("settings:write");
    }
    if (chunk.scope === "kb.instance.incidents") {
      return role === "admin" || role === "support" || perms.has("settings:write");
    }
    return false;
  });
}

function resolveDocsDir() {
  const candidates = [
    path.resolve(process.cwd(), "..", "..", "packages", "docs"),
    path.resolve(process.cwd(), "packages", "docs"),
    path.resolve(__dirname, "..", "..", "..", "..", "..", "packages", "docs"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) ?? null;
}

function markdownToChunks(fileName: string, raw: string): RagChunk[] {
  const docId = fileName.replace(/\.md$/i, "");
  const scope = scopeForFile(docId);
  const sourceType = scope === "docs.runbooks" ? "runbook" : "doc";
  const language = detectLanguage(raw);
  const lines = raw.split(/\r?\n/);
  const chunks: RagChunk[] = [];
  let currentSection = "Intro";
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    buffer = [];
    if (!content) return;
    const normalized = content.replace(/\n{2,}/g, "\n");
    for (const piece of splitChunk(normalized, 900)) {
      chunks.push({
        docId,
        section: currentSection,
        content: piece,
        sourceType,
        language,
        scope,
      });
    }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      currentSection = heading[2].trim().replace(/\s+/g, " ");
      continue;
    }
    buffer.push(line);
  }
  flush();

  return chunks;
}

function splitChunk(text: string, maxLen: number) {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.5) cut = remaining.lastIndexOf(". ", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

function scopeForFile(docId: string): RagScope {
  const upper = docId.toUpperCase();
  if (upper.includes("RUNBOOK") || upper.includes("GO_LIVE_CHECKLIST")) return "docs.runbooks";
  if (upper.includes("SECURITY") || upper.includes("SOC2") || upper.includes("PRIVACY")) return "docs.security";
  if (
    upper.includes("OPERATIONS") ||
    upper.includes("BACKUP") ||
    upper.includes("MIGRATION") ||
    upper.includes("DEPLOY") ||
    upper.includes("DISASTER")
  ) {
    return "docs.operations";
  }
  return "docs.general";
}

function detectLanguage(text: string): "es" | "en" | "mixed" {
  const lower = text.toLowerCase();
  const esHits = ["objetivo", "flujo", "configuracion", "certificacion", "ejemplo", "pruebas"].filter((w) =>
    lower.includes(w),
  ).length;
  const enHits = ["goal", "flow", "configuration", "example", "tests", "validation"].filter((w) =>
    lower.includes(w),
  ).length;
  if (esHits > 0 && enHits > 0) return "mixed";
  if (esHits > enHits) return "es";
  return "en";
}

function tokenize(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9#:/._-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function scoreChunk(chunk: RagChunk, qTokens: string[]) {
  const hay = `${chunk.docId} ${chunk.section} ${chunk.content}`.toLowerCase();
  let score = 0;
  for (const token of qTokens) {
    if (hay.includes(token)) score += 2;
    if (chunk.section.toLowerCase().includes(token)) score += 2;
    if (chunk.docId.toLowerCase().includes(token)) score += 1;
  }
  if (chunk.sourceType === "runbook") score += 0.5;
  if (chunk.scoreBoost) score += chunk.scoreBoost;
  return Number(score.toFixed(2));
}

