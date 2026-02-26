const SECRET_KEY_PATTERN = /(password|token|secret|api[-_]?key|authorization|cookie|passphrase)/i;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._\-+/=]+/gi;
const CARD_CANDIDATE_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidLuhn(digits: string) {
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (Number.isNaN(digit)) {
      return false;
    }
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function redactString(raw: string, keyName?: string): string {
  let value = raw;

  if (SECRET_KEY_PATTERN.test(keyName ?? "")) {
    return "[REDACTED_SECRET]";
  }

  value = value.replace(BEARER_PATTERN, "Bearer [REDACTED_SECRET]");
  value = value.replace(JWT_PATTERN, "[REDACTED_JWT]");
  value = value.replace(CARD_CANDIDATE_PATTERN, (candidate) => {
    const digits = normalizeDigits(candidate);
    return isValidLuhn(digits) ? "[REDACTED_CARD]" : candidate;
  });

  return value;
}

export function redactDeep<T = unknown>(input: T, parentKey?: string): T {
  if (typeof input === "string") {
    return redactString(input, parentKey) as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactDeep(item, parentKey)) as T;
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value === "string") {
        out[key] = redactString(value, key);
      } else {
        out[key] = redactDeep(value, key);
      }
    }
    return out as T;
  }
  return input;
}

export function dlpSummary(input: unknown) {
  const serialized = JSON.stringify(input ?? "");
  const candidates = serialized.match(CARD_CANDIDATE_PATTERN) ?? [];
  const cards = candidates.filter((candidate) => isValidLuhn(normalizeDigits(candidate))).length;
  const hasBearer = BEARER_PATTERN.test(serialized);
  const hasJwt = JWT_PATTERN.test(serialized);
  const hasSecrets = SECRET_KEY_PATTERN.test(serialized);
  return {
    cards,
    hasBearer,
    hasJwt,
    hasSecrets,
  };
}
