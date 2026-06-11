export function HealthBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        (ok
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800")
      }
    >
      <span
        className={
          "h-2 w-2 rounded-full " + (ok ? "bg-green-500" : "bg-red-500")
        }
        aria-hidden
      />
      {label}: {ok ? "ok" : "down"}
    </span>
  );
}
