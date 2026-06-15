import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPublishedWorkshopMeta, getWorkshopRegistration } from "@invoxai/db";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { safeUrl } from "@invoxai/utils/blocks";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";

export const dynamic = "force-dynamic";

export default async function WorkshopAccessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  const { slug } = await params;
  const workshop = await getPublishedWorkshopMeta(tenant.id, slug);
  if (!workshop) notFound();

  // ACCESS CONTROL: only a registrant (by profile or purchase email) sees the join
  // link. Without a registration we never reveal joinUrl.
  const registration = await getWorkshopRegistration({
    tenantId: tenant.id,
    workshopId: workshop.id,
    profileId: user.id,
    email: user.email ?? null,
  });

  if (!registration) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">{workshop.title}</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          You’re not registered for this workshop yet.
          <Link href={`/w/${workshop.slug}`} className="ml-1 font-medium underline">
            Register →
          </Link>
        </div>
      </main>
    );
  }

  const joinHref = workshop.joinUrl ? safeUrl(workshop.joinUrl) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/account" className="text-sm text-cyan underline">
        ← Your account
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{workshop.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {workshop.scheduledAt ? (
          <span className="font-medium text-zinc-700">🗓 {formatDateTimeShortIST(workshop.scheduledAt)}</span>
        ) : null}
        {workshop.durationMins ? <span>· {workshop.durationMins} min</span> : null}
      </div>
      {workshop.description ? (
        <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{workshop.description}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-5">
        {joinHref ? (
          <>
            <p className="text-sm font-medium text-zinc-900">Your join link</p>
            <a
              href={joinHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-white"
            >
              Join the session →
            </a>
            <p className="mt-2 text-xs text-muted">Keep this page handy — open the link when the session starts.</p>
          </>
        ) : (
          <p className="text-sm text-muted">
            You’re registered. The host will share the join link here before the session — check back closer to the time.
          </p>
        )}
      </div>
    </main>
  );
}
