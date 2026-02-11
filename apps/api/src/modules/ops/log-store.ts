export type OpsRequestLog = {
  at: string;
  level: string;
  msg: string;
  requestId?: string;
  userId?: string;
  companyId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
};

const logs: OpsRequestLog[] = [];
const MAX_LOGS = 200;

export function addRequestLog(entry: Omit<OpsRequestLog, "at">) {
  logs.unshift({ ...entry, at: new Date().toISOString() });
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS;
  }
}

export function getRequestLogs(limit = 50) {
  return logs.slice(0, limit);
}
