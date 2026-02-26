import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? "dev",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    beforeSend(event) {
      if (event.request) {
        const headers = { ...(event.request.headers ?? {}) } as Record<string, unknown>;
        delete headers.authorization;
        delete headers.cookie;
        event.request.headers = headers;
      }
      if (event.extra) {
        const extra = { ...event.extra } as Record<string, unknown>;
        for (const key of Object.keys(extra)) {
          if (/password|token|secret/i.test(key)) {
            extra[key] = "[REDACTED]";
          }
        }
        event.extra = extra;
      }
      return event;
    },
  });
}

export { Sentry };
