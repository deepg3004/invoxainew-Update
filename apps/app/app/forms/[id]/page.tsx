import {formatDateTimeShortIST} from "@invoxai/utils/date";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard } from "@invoxai/ui";
import {
  getLeadFormById,
  listLeadSubmissions,
} from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { setLeadFormStatusAction } from "../actions";

export const dynamic = "force-dynamic";

function publicBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

function formatDate(d: Date): string {
  return formatDateTimeShortIST(d);
}

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const form = await getLeadFormById(tenant.id, id);
  if (!form) notFound();

  const submissions = await listLeadSubmissions(tenant.id, form.id);
  const publicUrl = `${publicBase(tenant.username)}/f/${form.slug}`;
  const isPublished = form.status === "PUBLISHED";

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/forms" className="text-sm text-cyan underline">
        ← Lead forms
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{form.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {submissions.length} submission{submissions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublished ? (
            <form action={setLeadFormStatusAction.bind(null, form.id, "DRAFT")}>
              <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-100">
                Unpublish
              </button>
            </form>
          ) : (
            <form action={setLeadFormStatusAction.bind(null, form.id, "PUBLISHED")}>
              <button className="rounded-lg bg-brand-gradient px-3 py-1.5 text-sm font-medium text-white shadow-glow">
                Publish
              </button>
            </form>
          )}
          {form.status !== "ARCHIVED" ? (
            <form action={setLeadFormStatusAction.bind(null, form.id, "ARCHIVED")}>
              <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-muted hover:bg-zinc-100">
                Archive
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Share link */}
      <GlassCard className="mt-6">
        <p className="text-sm font-medium">Public link</p>
        {isPublished ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-cyan underline"
          >
            {publicUrl}
          </a>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Publish the form to share <span className="break-all">{publicUrl}</span>
          </p>
        )}
      </GlassCard>

      <h2 className="mt-10 text-xl font-bold">Submissions</h2>
      {submissions.length === 0 ? (
        <p className="mt-3 text-muted">
          No submissions yet. Share the link above to start collecting leads.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-200 bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900">{s.name ?? "—"}</div>
                  <div className="mt-0.5 space-x-2 text-sm">
                    {s.email ? (
                      <a href={`mailto:${s.email}`} className="text-cyan underline">
                        {s.email}
                      </a>
                    ) : null}
                    {s.phone ? (
                      <a
                        href={`https://wa.me/${s.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted underline hover:text-zinc-900"
                      >
                        {s.phone}
                      </a>
                    ) : null}
                  </div>
                  {s.message ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-muted">{s.message}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted">{formatDate(s.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
