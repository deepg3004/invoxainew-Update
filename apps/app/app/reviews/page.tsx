import { formatDateIST } from "@invoxai/utils/date";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { listTenantReviews } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { setReviewStatusAction } from "./actions";

export const dynamic = "force-dynamic";

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`}>
      <span className="text-amber-500">{"★".repeat(rating)}</span>
      <span className="text-zinc-300">{"★".repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

export default async function ReviewsPage() {
  const { tenant } = await requireTenant();
  const reviews = await listTenantReviews(tenant.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="InvoxAI · store"
        title="Reviews"
        description="Verified-purchase reviews on your products. Hide anything abusive — hidden reviews don't show on the public product page and don't count toward the rating."
      />

      {reviews.length === 0 ? (
        <GlassCard className="mt-6">
          <p className="text-sm text-muted">
            No reviews yet. They’ll appear here once buyers rate their purchases from their order
            receipt.
          </p>
        </GlassCard>
      ) : (
        <div className="mt-6 space-y-3">
          {reviews.map((r) => (
            <GlassCard key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <span className="text-sm font-medium text-zinc-900">{r.product.title}</span>
                    {r.status === "HIDDEN" ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-muted">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  {r.body ? (
                    <p className="mt-1.5 whitespace-pre-line text-sm text-zinc-700">{r.body}</p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-muted">
                    {r.authorName || "Verified buyer"} · {formatDateIST(r.createdAt)}
                  </p>
                </div>
                <form
                  action={setReviewStatusAction.bind(
                    null,
                    r.id,
                    r.status === "HIDDEN" ? "PUBLISHED" : "HIDDEN",
                  )}
                >
                  <Button type="submit" variant="secondary" size="sm">
                    {r.status === "HIDDEN" ? "Show" : "Hide"}
                  </Button>
                </form>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
