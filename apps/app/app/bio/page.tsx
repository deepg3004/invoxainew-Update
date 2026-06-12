import { GlassCard } from "@invoxai/ui";
import { getBioLink, getBioLinkClickStats } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { saveBioLinkAction } from "./actions";

export const dynamic = "force-dynamic";

function publicBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

const SOCIALS: { name: string; label: string }[] = [
  { name: "instagram", label: "Instagram URL" },
  { name: "youtube", label: "YouTube URL" },
  { name: "twitter", label: "X / Twitter URL" },
  { name: "facebook", label: "Facebook URL" },
  { name: "whatsapp", label: "WhatsApp link" },
  { name: "website", label: "Website URL" },
];

export default async function BioEditorPage() {
  const { tenant } = await requireTenant();
  const [bio, clicks] = await Promise.all([
    getBioLink(tenant.id),
    getBioLinkClickStats(tenant.id),
  ]);
  const publicUrl = `${publicBase(tenant.username)}/bio`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        InvoxAI · build
      </p>
      <h1 className="mt-1 text-3xl font-bold">Bio link</h1>
      <p className="mt-2 text-muted">
        One link for your socials — share <code className="text-cyan">{publicUrl}</code>.
      </p>

      <GlassCard className="mt-4">
        <p className="text-sm">
          Public link:{" "}
          {bio?.published ? (
            <a href={publicUrl} target="_blank" rel="noreferrer" className="text-cyan underline">
              {publicUrl}
            </a>
          ) : (
            <span className="text-muted">publish below to make it live</span>
          )}
        </p>
      </GlassCard>

      {clicks.total > 0 ? (
        <GlassCard className="mt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-base font-semibold">Link clicks</h2>
            <span className="text-sm text-muted">{clicks.total} total</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {clicks.byTarget.slice(0, 8).map((c) => (
              <li key={c.targetUrl} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-zinc-900">
                  {c.label ?? c.targetUrl}
                </span>
                <span className="shrink-0 text-muted">{c.clicks}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      <form action={saveBioLinkAction} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input name="displayName" defaultValue={bio?.displayName ?? ""} placeholder={tenant.name ?? tenant.username} className={inputCls} />
        </div>
        <div>
          <label className="text-sm font-medium">Bio</label>
          <textarea name="bio" rows={3} defaultValue={bio?.bio ?? ""} placeholder="A line about you or your business." className={inputCls} />
        </div>
        <div>
          <label className="text-sm font-medium">Avatar image URL</label>
          <input name="avatarUrl" defaultValue={bio?.avatarUrl ?? ""} placeholder="https://…" className={inputCls} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <div key={s.name}>
              <label className="text-sm font-medium">{s.label}</label>
              <input
                name={s.name}
                defaultValue={(bio?.[s.name as keyof typeof bio] as string | null) ?? ""}
                placeholder="https://…"
                className={inputCls}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium">Links</label>
          <p className="text-xs text-muted">One per line, as <code>Label | https://link</code></p>
          <textarea
            name="linksText"
            rows={5}
            defaultValue={bio?.linksText ?? ""}
            placeholder={"My store | https://…\nFree guide | https://…"}
            className={`${inputCls} font-mono`}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={bio?.published ?? false} /> Published (page is live)
        </label>

        <button className="w-full rounded-xl bg-brand-gradient px-4 py-2.5 font-medium text-white shadow-glow">
          Save bio link
        </button>
      </form>
    </div>
  );
}
