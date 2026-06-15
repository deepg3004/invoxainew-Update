/**
 * Byte-size helpers for the media library. Pure + client-safe (no imports), so both
 * the server page and the client list can format sizes and compute the usage bar.
 */

/** Default per-tenant storage allowance (1 GiB) until per-plan limits are wired. */
export const DEFAULT_STORAGE_BYTES = 1024 * 1024 * 1024;

/** Human-readable size, e.g. 0 → "0 B", 1536 → "1.5 KB", 1048576 → "1 MB". */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const value = n / 1024 ** i;
  // Whole numbers show no decimal; otherwise one decimal place.
  const str = value >= 100 || Number.isInteger(value) ? String(Math.round(value)) : value.toFixed(1);
  return `${str} ${units[i]}`;
}

/** Usage as a 0–100 integer percentage of the limit (clamped). limit ≤ 0 → 0. */
export function storageUsagePct(usedBytes: number, limitBytes: number): number {
  if (limitBytes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((usedBytes / limitBytes) * 100)));
}

/** Would adding `addBytes` exceed the limit? Used to gate an upload before storing. */
export function exceedsStorageLimit(usedBytes: number, addBytes: number, limitBytes: number): boolean {
  return usedBytes + addBytes > limitBytes;
}
