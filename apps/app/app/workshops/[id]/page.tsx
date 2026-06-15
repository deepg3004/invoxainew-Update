import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getWorkshopById, countWorkshopRegistrations, seatsRemaining } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { WorkshopForm } from "../WorkshopForm";
import { updateWorkshopAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditWorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const workshop = await getWorkshopById(tenant.id, id);
  if (!workshop) notFound();
  const registered = await countWorkshopRegistrations(workshop.id);
  const left = seatsRemaining(workshop.maxSeats, registered);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · workshops"
        title="Edit workshop"
        description={`${workshop.title} · ${registered} registered${left !== null ? ` · ${left} seat${left === 1 ? "" : "s"} left` : ""}`}
      />
      <GlassCard>
        <WorkshopForm
          action={updateWorkshopAction.bind(null, workshop.id)}
          submitLabel="Save workshop"
          initial={{
            slug: workshop.slug,
            title: workshop.title,
            description: workshop.description,
            pricePaise: workshop.pricePaise,
            compareAtPaise: workshop.compareAtPaise,
            imageUrl: workshop.imageUrl,
            joinUrl: workshop.joinUrl,
            scheduledAt: workshop.scheduledAt,
            durationMins: workshop.durationMins,
            maxSeats: workshop.maxSeats,
            sortOrder: workshop.sortOrder,
          }}
        />
      </GlassCard>
    </div>
  );
}
