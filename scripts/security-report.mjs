import process from "node:process";

async function main() {
  const url = process.env.CONTROL_PLANE_URL;
  const token = process.env.CONTROL_PLANE_SECURITY_TOKEN;
  if (!url || !token) {
    console.log("security-report: CONTROL_PLANE_URL or CONTROL_PLANE_SECURITY_TOKEN missing");
    return;
  }

  const payload = {
    instanceId: process.env.SECURITY_REPORT_INSTANCE_ID ?? null,
    repo: process.env.SECURITY_REPORT_REPO ?? null,
    sha: process.env.SECURITY_REPORT_SHA ?? null,
    runId: process.env.SECURITY_REPORT_RUN_ID ?? null,
    kind: process.env.SECURITY_REPORT_KIND ?? "ci",
    status: process.env.SECURITY_REPORT_STATUS ?? "unknown",
    summary: process.env.SECURITY_REPORT_SUMMARY ? JSON.parse(process.env.SECURITY_REPORT_SUMMARY) : null,
  };

  const res = await fetch(`${url.replace(/\/$/, "")}/api/security-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-security-token": token,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("security-report failed", res.status, text);
    process.exit(1);
  }
  console.log("security-report sent");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
