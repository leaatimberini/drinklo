export type RegionalHealthSample = {
  region: string;
  role?: "primary" | "secondary";
  ok: boolean;
  latency_ms?: number;
  checked_at: string;
  endpoint?: string;
};

export type HeartbeatPayload = {
  instance_id: string;
  domain?: string;
  client?: string;
  version?: string;
  release_channel?: string;
  health?: string;
  uptime_seconds?: number;
  db_ok: boolean;
  redis_ok: boolean;
  storage_ok: boolean;
  search_ok?: boolean;
  jobs_failed: number;
  secrets_expired?: number;
  secrets_unverified?: number;
  slo_p95_ms?: number;
  slo_error_rate?: number;
  slo_webhook_retry_rate?: number;
  slo_updated_at?: string;
  events_total_1h?: number;
  events_failed_1h?: number;
  events_avg_lag_ms?: number;
  last_backup_at?: string | null;
  backup_id?: string;
  backup_size_bytes?: number;
  backup_checksum?: string;
  backup_bucket?: string;
  backup_path?: string;
  cpu_usage_pct?: number;
  memory_used_bytes?: number;
  memory_total_bytes?: number;
  disk_used_bytes?: number;
  disk_total_bytes?: number;
  network_rx_bytes?: number;
  network_tx_bytes?: number;
  db_size_bytes?: number;
  storage_size_bytes?: number;
  jobs_processed_1h?: number;
  jobs_pending?: number;
  iam_sso_enabled?: boolean;
  iam_mfa_enforced?: boolean;
  iam_scim_enabled?: boolean;
  iam_last_sync_at?: string;
  primary_region?: string;
  regional_health?: RegionalHealthSample[];
  alerts?: Array<{ level: string; message: string }>;
  job_failures?: Array<{ queue?: string; message: string }>;
};

export function validateHeartbeat(payload: HeartbeatPayload) {
  if (!payload.instance_id) {
    throw new Error("instance_id required");
  }
  return payload;
}
