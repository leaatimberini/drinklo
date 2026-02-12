export type HoldLike = {
  customerId: string;
  customerEmailSnapshot?: string | null;
  periodFrom?: Date | null;
  periodTo?: Date | null;
  status?: "ACTIVE" | "RELEASED";
};

export function isDateInHoldRange(date: Date, hold: HoldLike) {
  if (hold.periodFrom && date.getTime() < hold.periodFrom.getTime()) return false;
  if (hold.periodTo && date.getTime() > hold.periodTo.getTime()) return false;
  return true;
}

export function matchesHoldByCustomerId(holds: HoldLike[], customerId: string, at: Date) {
  return holds.some((hold) => (hold.status ?? "ACTIVE") === "ACTIVE" && hold.customerId === customerId && isDateInHoldRange(at, hold));
}

export function matchesHoldByEmail(holds: HoldLike[], email: string, at: Date) {
  const normalized = email.toLowerCase();
  return holds.some(
    (hold) =>
      (hold.status ?? "ACTIVE") === "ACTIVE" &&
      hold.customerEmailSnapshot?.toLowerCase() === normalized &&
      isDateInHoldRange(at, hold),
  );
}
