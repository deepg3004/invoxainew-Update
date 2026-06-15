import { GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { BookingTypeForm } from "../BookingTypeForm";
import { createBookingTypeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBookingTypePage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · 1-on-1"
        title="New 1-on-1"
        description="Set up a consultation. You'll add your available time slots after creating it."
      />
      <GlassCard>
        <BookingTypeForm action={createBookingTypeAction} submitLabel="Create" />
      </GlassCard>
    </div>
  );
}
