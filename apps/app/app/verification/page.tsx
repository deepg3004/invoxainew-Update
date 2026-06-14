import { GlassCard, PageHeader } from "@invoxai/ui";
import { getVerification, listKycDocuments } from "@invoxai/db";
import { createSignedDownloadUrl } from "@invoxai/auth/server";
import { formatDateIST } from "@invoxai/utils/date";
import { requireTenant } from "../../lib/tenant";
import { VerificationForm } from "./VerificationForm";
import { KycUploadForm } from "./KycUploadForm";
import { deleteKycDocumentAction } from "./actions";

export const dynamic = "force-dynamic";

const DOC_TYPE_LABEL: Record<string, string> = {
  identity: "Identity proof",
  business: "Business / GST",
  address: "Address proof",
  other: "Other document",
};

export default async function VerificationPage() {
  const { tenant } = await requireTenant();
  const v = await getVerification(tenant.id);
  const status = v?.verificationStatus ?? "UNVERIFIED";

  // KYC docs + short-lived signed view URLs (key never reaches the browser).
  const docs = await listKycDocuments(tenant.id);
  const docViews = await Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      docType: d.docType,
      fileName: d.fileName,
      createdAt: d.createdAt,
      url: await createSignedDownloadUrl(d.storageKey, 600, tenant.id),
    })),
  );

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

      <GlassCard className="mt-6" title="Verification documents">
        <p className="text-sm text-muted">
          Upload documents that prove your identity or business (ID, GST/registration, address proof).
          Files are private — visible only to you and InvoxAI’s review team, never on your storefront.
        </p>

        {docViews.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-surface">
            {docViews.map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-medium uppercase tracking-wide text-muted">
                    {DOC_TYPE_LABEL[d.docType] ?? d.docType}
                  </span>
                  <span className="block truncate text-sm text-zinc-900">{d.fileName}</span>
                  <span className="block text-xs text-muted">{formatDateIST(d.createdAt)}</span>
                </div>
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm font-medium text-cyan hover:underline"
                  >
                    View
                  </a>
                ) : null}
                <form action={deleteKycDocumentAction.bind(null, d.id)} className="shrink-0">
                  <button className="text-sm text-muted underline hover:text-red-700">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No documents uploaded yet.</p>
        )}

        {status !== "VERIFIED" ? (
          <div className="mt-5 border-t border-zinc-200 pt-5">
            <KycUploadForm />
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
