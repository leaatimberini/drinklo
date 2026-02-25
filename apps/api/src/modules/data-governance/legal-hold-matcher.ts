export type HoldLike = {
  customerId?: string | null;
  customerEmailSnapshot?: string | null;
  userId?: string | null;
  userEmailSnapshot?: string | null;
  entityScopes?: string[] | null;
  periodFrom?: Date | null;
  periodTo?: Date | null;
  status?: "ACTIVE" | "RELEASED";
};

export function isDateInHoldRange(date: Date, hold: HoldLike) {
  if (hold.periodFrom && date.getTime() < hold.periodFrom.getTime()) return false;
  if (hold.periodTo && date.getTime() > hold.periodTo.getTime()) return false;
  return true;
}

export function holdAppliesToEntity(hold: HoldLike, entity: string) {
  if (!hold.entityScopes || hold.entityScopes.length === 0) return true;
  return hold.entityScopes.includes(entity);
}

export function matchesHoldByCustomerId(holds: HoldLike[], customerId: string, at: Date, entity?: string) {
  return holds.some(
    (hold) =>
      (hold.status ?? "ACTIVE") === "ACTIVE" &&
      hold.customerId === customerId &&
      (!entity || holdAppliesToEntity(hold, entity)) &&
      isDateInHoldRange(at, hold),
  );
}

export function matchesHoldByEmail(holds: HoldLike[], email: string, at: Date, entity?: string) {
  const normalized = email.toLowerCase();
  return holds.some(
    (hold) =>
      (hold.status ?? "ACTIVE") === "ACTIVE" &&
      hold.customerEmailSnapshot?.toLowerCase() === normalized &&
      (!entity || holdAppliesToEntity(hold, entity)) &&
      isDateInHoldRange(at, hold),
  );
}

export function matchesHoldByUserId(holds: HoldLike[], userId: string, at: Date, entity?: string) {
  return holds.some(
    (hold) =>
      (hold.status ?? "ACTIVE") === "ACTIVE" &&
      hold.userId === userId &&
      (!entity || holdAppliesToEntity(hold, entity)) &&
      isDateInHoldRange(at, hold),
  );
}
