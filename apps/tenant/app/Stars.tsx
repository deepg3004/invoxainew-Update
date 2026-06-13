/**
 * Display-only star rating (server-renderable). Rounds `value` to whole stars and
 * colours filled ones amber. Used on product pages and in review lists.
 */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span
      className={`inline-flex ${className}`}
      aria-label={`${value.toFixed(1)} out of 5 stars`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden className={n <= full ? "text-amber-500" : "text-zinc-300"}>
          ★
        </span>
      ))}
    </span>
  );
}
