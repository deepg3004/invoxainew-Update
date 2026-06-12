// All InvoxAI date/time display is in IST (Asia/Kolkata) — the VPS runs UTC, so
// every formatter MUST pin the timezone. Use these helpers instead of a bare
// Intl.DateTimeFormat so the timezone can never be forgotten.

const IST = "Asia/Kolkata";

/** Generic IST formatter — pins the timezone and merges your options. */
export function formatIST(
  d: Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...options }).format(d);
}

/** "12 Jun 2026" */
export function formatDateIST(d: Date | null): string {
  return d
    ? formatIST(d, { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

/** "12 Jun 2026, 1:30 am" */
export function formatDateTimeIST(d: Date | null): string {
  return d
    ? formatIST(d, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
}

/** "12 Jun, 1:30 am" (no year — for recent/activity timestamps) */
export function formatDateTimeShortIST(d: Date | null): string {
  return d
    ? formatIST(d, {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
}

/** "June 2026" */
export function formatMonthIST(d: Date | null): string {
  return d ? formatIST(d, { month: "long", year: "numeric" }) : "—";
}
