export type DastFindingListItem = {
  severity: string;
  status: string;
};

export function summarizeFindings(findings: DastFindingListItem[]) {
  const summary = {
    total: findings.length,
    bySeverity: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  };

  for (const finding of findings) {
    const severity = String(finding.severity || "info").toLowerCase();
    const status = String(finding.status || "open").toLowerCase();

    summary.bySeverity[severity] = (summary.bySeverity[severity] ?? 0) + 1;
    summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1;
  }

  return summary;
}
