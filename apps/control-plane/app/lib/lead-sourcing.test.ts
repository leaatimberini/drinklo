import assert from "node:assert/strict";
import test from "node:test";
import { enrichLeadSourcingRows, mapLeadSourcingRows, parseAndEnrichLeadSourcingCsv, parseLeadCsv } from "./lead-sourcing";

test("lead sourcing parse + enrichment is deterministic with CSV fixtures", () => {
  const csv = [
    "empresa,rubro,ciudad,contacto,canal",
    'Distribuidora Sur,Distribuidora bebidas,Rosario,"Juan Perez <juan@sur.com>",partner',
    "Kiosco Centro,Kiosco,CABA,1144556677,inbound",
    "Bar Norte,Bar,Córdoba,contacto@barnorte.com,evento",
  ].join("\n");

  const parsed = parseAndEnrichLeadSourcingCsv(csv);
  assert.equal(parsed.headers.length, 5);
  assert.equal(parsed.summary.totalRows, 3);
  assert.equal(parsed.summary.highPotential >= 1, true);

  const dist = parsed.enriched[0];
  assert.equal(dist.empresa, "Distribuidora Sur");
  assert.equal(dist.email, "juan@sur.com");
  assert.equal(dist.tags.includes("icp:distribuidora"), true);
  assert.equal(dist.recommendedTasks.includes("Agendar demo"), true);
  assert.equal(dist.recommendedStage === "DEMO" || dist.recommendedStage === "CONTACTED", true);

  const kiosco = parsed.enriched[1];
  assert.equal(kiosco.phone != null, true);
  assert.equal(kiosco.tags.includes("icp:kiosco"), true);
});

test("mapping + enrichment fallback handles missing columns and dedupe keys", () => {
  const { rows } = parseLeadCsv("empresa,ciudad,contacto\nAcme Drinks,La Plata,info@acme.com\nAcme Drinks,La Plata,1144445555");
  const mapped = mapLeadSourcingRows(rows);
  const enriched = enrichLeadSourcingRows(mapped);

  assert.equal(enriched.length, 2);
  assert.equal(enriched[0].dedupeKey, "email:info@acme.com");
  assert.match(enriched[1].dedupeKey, /^company-city:/);
  assert.equal(enriched[1].warnings.includes("city_missing"), false);
  assert.equal(enriched[0].potentialScore > 0, true);
});

