import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getBookingTypeById, listSlots, listBookingsForType } from "@invoxai/db";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { requireTenant } from "../../../lib/tenant";
import { BookingTypeForm } from "../BookingTypeForm";
import { SlotManager } from "../SlotManager";
import { updateBookingTypeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditBookingTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const type = await getBookingTypeById(tenant.id, id);
  if (!type) notFound();
  const [slots, bookings] = await Promise.all([listSlots(type.id), listBookingsForType(tenant.id, type.id)]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="InvoxAI · 1-on-1" title="Edit 1-on-1" description={type.title} />

      <GlassCard>
        <BookingTypeForm
          action={updateBookingTypeAction.bind(null, type.id)}
          submitLabel="Save"
          initial={{
            slug: type.slug,
            title: type.title,
            description: type.description,
            pricePaise: type.pricePaise,
            compareAtPaise: type.compareAtPaise,
            imageUrl: type.imageUrl,
            meetingUrl: type.meetingUrl,
            durationMins: type.durationMins,
            sortOrder: type.sortOrder,
          }}
        />
      </GlassCard>

      <GlassCard className="mt-6" title="Available time slots">
        <SlotManager
          bookingTypeId={type.id}
          slots={slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), status: s.status }))}
        />
      </GlassCard>

      <GlassCard className="mt-6" title={`Bookings (${bookings.length})`}>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">No bookings yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-zinc-800">{b.buyerEmail ?? "Buyer"}</span>
                <span className="shrink-0 text-xs text-muted">
                  {b.startsAt ? formatDateTimeShortIST(b.startsAt) : "—"}
                  {!b.slotId ? " · needs reschedule" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
