export function baDateRangeToUtc(fromYmd: string, toYmd: string) {
  const from = String(fromYmd ?? "").trim();
  const to = String(toYmd ?? "").trim();
  if (!from || !to) {
    throw new Error("from/to required");
  }

  // Buenos Aires does not currently observe DST; use fixed -03:00 offset.
  const fromUtc = new Date(`${from}T00:00:00-03:00`);
  const toUtc = new Date(`${to}T23:59:59.999-03:00`);
  if (Number.isNaN(fromUtc.getTime()) || Number.isNaN(toUtc.getTime())) {
    throw new Error("invalid date");
  }
  if (fromUtc.getTime() > toUtc.getTime()) {
    throw new Error("invalid range");
  }
  return { fromUtc, toUtc };
}

