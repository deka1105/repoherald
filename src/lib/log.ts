import * as Sentry from "@sentry/nextjs";

type LogFields = Record<string, unknown>;

// Structured JSON lines so Vercel log search/drains can filter on fields;
// errors additionally go to Sentry when SENTRY_DSN is configured.
function emit(level: "info" | "warn" | "error", event: string, fields: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields: LogFields = {}) => emit("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => emit("warn", event, fields),
  error: (event: string, error: unknown, fields: LogFields = {}) => {
    emit("error", event, {
      ...fields,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error, { tags: { event }, extra: fields });
    }
  },
};
