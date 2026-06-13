import { GlassCard, PageHeader } from "@invoxai/ui";
import { getVerification } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { VerificationForm } from "./VerificationForm";

export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const { tenant } = await requireTenant();
  const v = await getVerification(tenant.id);
  const status = v?.verificationStatus ?? "UNVERIFIED";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="InvoxAI · trust"
        title="Get verified"
        description="A verified badge on your storefront builds buyer trust. Submit your business details and an admin will review them."
      />

      <GlassCard className="mt-6">
        {status === "VERIFIED" ? (
          <div className="text-sm">
            <p className="font-semibold text-emerald-700">✓ Your store is verified.</p>
            <p className="mt-1 text-muted">Buyers see a “Verified” badge on your storefront.</p>
          </div>
        ) : status === "PENDING" ? (
          <div className="text-sm">
            <p className="font-semibold text-amber-700">Under review</p>
            <p className="mt-1 text-muted">
              Your submission is being reviewed. We’ll update this page once it’s done.
            </p>
          </div>
        ) : (
          <>
            {status === "REJECTED" ? (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Your last submission wasn’t approved.
                {v?.verificationReviewNote ? ` Reviewer note: ${v.verificationReviewNote}` : ""}{" "}
                You can update your details and re-submit.
              </div>
            ) : null}
            <VerificationForm resubmit={status === "REJECTED"} />
          </>
        )}
      </GlassCard>
    </div>
  );
}
