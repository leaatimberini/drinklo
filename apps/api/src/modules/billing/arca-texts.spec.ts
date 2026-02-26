import fs from "node:fs";
import path from "node:path";

function extractKeyLines(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => line.includes("ARCA") || line.includes("WSAA") || line.includes("WSFEv1"))
    .map((line) => line.trim())
    .filter(Boolean);
}

describe("ARCA texts", () => {
  it("keeps key ARCA wording in docs", () => {
    const docsDir = path.resolve(__dirname, "..", "..", "..", "..", "..", "packages", "docs");
    const arcaDoc = fs.readFileSync(path.join(docsDir, "ARCA_AFIP.md"), "utf8");
    const billingDoc = fs.readFileSync(path.join(docsDir, "AFIP_BILLING.md"), "utf8");
    const lines = [...extractKeyLines(arcaDoc), ...extractKeyLines(billingDoc)];
    expect(lines).toMatchSnapshot();
  });
});
