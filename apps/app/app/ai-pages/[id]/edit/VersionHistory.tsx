import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { GlassCard } from "@invoxai/ui";
import { restoreAiPageVersionAction } from "../../actions";

/** Version-history panel below the editor. Each save is a snapshot; restoring an
 *  older one brings it back (the current state is snapshotted too, so it's safe). */
export function VersionHistory({
  pageId,
  versions,
}: {
  pageId: string;
  versions: { id: string; createdAt: Date }[];
}) {
  if (versions.length === 0) return null;
  return (
    <div className="mx-auto mt-8 max-w-6xl">
      <GlassCard title="Version history">
        <p className="text-sm text-muted">
          Every save is snapshotted (latest 20 kept). Restoring brings a version back — your
          current version is saved too, so it&apos;s safe to try.
        </p>
        <ul className="mt-3 divide-y divide-zinc-100">
          {versions.map((v, i) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-zinc-700">
                {formatDateTimeShortIST(v.createdAt)}
                {i === 0 ? (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    current
                  </span>
                ) : null}
              </span>
              {i === 0 ? (
                <span className="text-xs text-muted">latest save</span>
              ) : (
                <form action={restoreAiPageVersionAction.bind(null, pageId, v.id)}>
                  <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50">
                    Restore
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
