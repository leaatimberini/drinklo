const BUENOS_AIRES_OFFSET_HOURS = 3;
const BUENOS_AIRES_OFFSET_MS = BUENOS_AIRES_OFFSET_HOURS * 60 * 60 * 1000;

function toBuenosAiresWallClock(date: Date) {
  return new Date(date.getTime() - BUENOS_AIRES_OFFSET_MS);
}

function fromBuenosAiresWallClock(date: Date) {
  return new Date(date.getTime() + BUENOS_AIRES_OFFSET_MS);
}

export function addDaysPreservingBuenosAiresWallClock(baseDate: Date, days: number) {
  const wallClock = toBuenosAiresWallClock(baseDate);
  wallClock.setUTCDate(wallClock.getUTCDate() + days);
  return fromBuenosAiresWallClock(wallClock);
}

export function buildTrialPeriod(now = new Date(), trialDays = 30) {
  return {
    currentPeriodStart: now,
    currentPeriodEnd: addDaysPreservingBuenosAiresWallClock(now, trialDays),
    trialEndAt: addDaysPreservingBuenosAiresWallClock(now, trialDays),
  };
}

export function getCurrentUsagePeriodBuenosAires(now = new Date()) {
  const wallClock = toBuenosAiresWallClock(now);
  const year = wallClock.getUTCFullYear();
  const monthIndex = wallClock.getUTCMonth();

  const periodStartUtc = new Date(
    Date.UTC(year, monthIndex, 1, BUENOS_AIRES_OFFSET_HOURS, 0, 0, 0),
  );
  const periodEndUtc = new Date(
    Date.UTC(year, monthIndex + 1, 1, BUENOS_AIRES_OFFSET_HOURS, 0, 0, 0),
  );
  const periodKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  return {
    periodKey,
    periodStart: periodStartUtc,
    periodEnd: periodEndUtc,
    timezone: "America/Argentina/Buenos_Aires",
  };
}

