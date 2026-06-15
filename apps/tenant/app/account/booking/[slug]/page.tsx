import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPublishedBookingTypeMeta, getBuyerBookingForType } from "@invoxai/db";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { safeUrl } from "@invoxai/utils/blocks";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";

export const dynamic = "force-dynamic";

export default async function BookingAccessPage({
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
  const type = await getPublishedBookingTypeMeta(tenant.id, slug);
  if (!type) notFound();

  // ACCESS CONTROL: only someone who booked sees the meeting link.
  const booking = await getBuyerBookingForType({
    tenantId: tenant.id,
    bookingTypeId: type.id,
    profileId: user.id,
    email: user.email ?? null,
  });

  if (!booking) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">{type.title}</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          You haven’t booked this yet.
          <Link href={`/b/${type.slug}`} className="ml-1 font-medium underline">
            Book →
          </Link>
        </div>
      </main>
    );
  }

  const meetingHref = type.meetingUrl ? safeUrl(type.meetingUrl) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/account" className="text-sm text-cyan underline">
        ← Your account
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{type.title}</h1>
      {booking.startsAt ? (
        <p className="mt-2 text-sm font-medium text-zinc-700">
          🗓 {formatDateTimeShortIST(booking.startsAt)}
          {type.durationMins ? ` · ${type.durationMins} min` : ""}
        </p>
      ) : (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Your payment is confirmed — the seller will reschedule your exact time and update you.
        </p>
      )}
      {type.description ? (
        <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{type.description}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-5">
        {meetingHref ? (
          <>
            <p className="text-sm font-medium text-zinc-900">Your meeting link</p>
            <a
              href={meetingHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-white"
            >
              Join the call →
            </a>
            <p className="mt-2 text-xs text-muted">Open this link at your session time.</p>
          </>
        ) : (
          <p className="text-sm text-muted">
            You’re booked. The seller will share the meeting link here before your session.
          </p>
        )}
      </div>
    </main>
  );
}
