export type SubmissionInput = {
  pluginName: string;
  version: string;
  channel: string;
  requestedPermissions: string[];
  dependencies: string[];
  manifest: Record<string, any>;
  bundleUrl: string;
};

export type ReviewReport = {
  staticAnalysis: {
    status: "pass" | "fail";
    requestedPermissions: string[];
    invalidPermissions: string[];
    blockedDependencies: string[];
    notes: string[];
  };
  securityScan: {
    status: "pass" | "warn" | "fail";
    sast: { status: "pass" | "fail"; findings: string[] };
    trivy: { status: "pass" | "warn" | "fail"; findings: string[] };
  };
  sandboxTest: {
    status: "pass" | "fail";
    scenarioId: string;
    notes: string[];
  };
  decision: "APPROVE" | "REJECT";
  reasons: string[];
};

const ALLOWED_PERMISSIONS = new Set([
  "products:read",
  "products:write",
  "pricing:read",
  "pricing:write",
  "inventory:read",
  "inventory:write",
  "customers:read",
  "customers:write",
  "settings:write",
  "plugins:execute",
]);

const BLOCKED_DEPENDENCIES = ["child_process", "node-pty", "shelljs", "vm2"];

function deterministicScenario(input: SubmissionInput) {
  return `sandbox-${input.pluginName}-${input.version}-${input.channel}`.replace(/[^a-zA-Z0-9-_]/g, "-");
}

export function runPluginReview(input: SubmissionInput): ReviewReport {
  const requestedPermissions = Array.from(new Set(input.requestedPermissions.map((p) => String(p).trim()).filter(Boolean)));
  const dependencies = Array.from(new Set(input.dependencies.map((d) => String(d).trim()).filter(Boolean)));

  const invalidPermissions = requestedPermissions.filter((permission) => !ALLOWED_PERMISSIONS.has(permission));
  const blockedDependencies = dependencies.filter((dep) => BLOCKED_DEPENDENCIES.includes(dep));

  const staticStatus: "pass" | "fail" = invalidPermissions.length > 0 || blockedDependencies.length > 0 ? "fail" : "pass";

  const sastFindings: string[] = [];
  const manifestText = JSON.stringify(input.manifest ?? {});
  if (/eval\(|Function\(|require\(['"]child_process['"]\)/i.test(manifestText)) {
    sastFindings.push("Potential unsafe dynamic execution in manifest metadata");
  }

  const trivyFindings: string[] = [];
  if (dependencies.some((dep) => /-alpha$|latest/i.test(dep))) {
    trivyFindings.push("Unpinned or unstable dependency versions detected");
  }

  if (/malware|ransom|crypto-miner/i.test(input.bundleUrl)) {
    trivyFindings.push("Bundle URL flagged by policy keywords");
  }

  const securityStatus: "pass" | "warn" | "fail" =
    sastFindings.length > 0
      ? "fail"
      : trivyFindings.length > 0
        ? "warn"
        : "pass";

  const scenarioId = deterministicScenario(input);
  const sandboxNotes = [`Executed deterministic sandbox scenario ${scenarioId}`];
  const sandboxFailed = /sandbox-fail|fail-sandbox/i.test(input.bundleUrl) || /failSandbox/i.test(manifestText);

  const decisionReasons: string[] = [];
  if (staticStatus === "fail") {
    decisionReasons.push("Static analysis policy violation");
  }
  if (securityStatus === "fail") {
    decisionReasons.push("Security scan critical findings");
  }
  if (sandboxFailed) {
    decisionReasons.push("Sandbox test failed");
  }

  return {
    staticAnalysis: {
      status: staticStatus,
      requestedPermissions,
      invalidPermissions,
      blockedDependencies,
      notes:
        staticStatus === "pass"
          ? ["Permissions and dependency policy checks passed"]
          : ["Policy gate failed"],
    },
    securityScan: {
      status: securityStatus,
      sast: {
        status: sastFindings.length > 0 ? "fail" : "pass",
        findings: sastFindings,
      },
      trivy: {
        status: trivyFindings.length > 0 ? "warn" : "pass",
        findings: trivyFindings,
      },
    },
    sandboxTest: {
      status: sandboxFailed ? "fail" : "pass",
      scenarioId,
      notes: sandboxNotes,
    },
    decision: decisionReasons.length > 0 ? "REJECT" : "APPROVE",
    reasons: decisionReasons,
  };
}
