// Sentry server-side error reporting (Phase 1.4). Env-gated: only active when
// SENTRY_DSN is set, so it's a no-op until you add a DSN. Captures server / API
// route / RSC errors. (Client-side capture + source maps would add a
// withSentryConfig wrap in next.config — a follow-up.)
export async function register() {
  if (process.env.SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV ?? "production",
    });
  }
}

export async function onRequestError(
  error: unknown,
  request: unknown,
  context: unknown,
) {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Sentry.captureRequestError(error as any, request as any, context as any);
  }
}
