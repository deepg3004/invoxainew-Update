import Link from "next/link";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { listDomains, planAllowsCustomDomain } from "@invoxai/db";
import { serverEnv } from "@invoxai/config";
import { requireTenant } from "../../lib/tenant";
import { AddDomainForm } from "./AddDomainForm";
import { verifyDomainAction, deleteDomainAction } from "./actions";

export const dynamic = "force-dynamic";

const MSG: Record<string, { text: string; tone: "ok" | "err" }> = {
  verified: { text: "Domain verified — it’s now live (TLS may take a minute).", tone: "ok" },
  txt_missing: {
    text: "We couldn’t find the TXT record yet. DNS can take a while to propagate — try again shortly.",
    tone: "err",
  },
  conflict: { text: "That domain is already verified on another account.", tone: "err" },
};

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { tenant } = await requireTenant();
  const [domains, { msg }, allowed] = await Promise.all([
    listDomains(tenant.id),
    searchParams,
    planAllowsCustomDomain(tenant.id),
  ]);
  const aTarget = serverEnv().CUSTOM_DOMAIN_A_TARGET;
  const banner = msg ? MSG[msg] : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI"
        title="Custom domains"
        description={
          <>
            Serve your site on your own domain. Your default address
            ({tenant.username}.invoxai.io) keeps working too.
          </>
        }
      />

      {banner ? (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            banner.tone === "ok" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {banner.text}
        </p>
      ) : null}

      {!allowed ? (
        <div className="mt-6">
          <GlassCard title="Upgrade to connect a custom domain">
            <p className="text-sm text-muted">
              Custom domains are a premium feature. Upgrade your plan to serve your
              site on your own domain.
            </p>
            <Link
              href="/billing"
              className="mt-3 inline-block text-sm font-medium text-brand-strong underline"
            >
              View plans →
            </Link>
          </GlassCard>
        </div>
      ) : (
        <div className="mt-6">
          <GlassCard title="Add a domain">
            <AddDomainForm />
          </GlassCard>
        </div>
      )}

      {domains.length > 0 ? (
        <GlassCard className="mt-6 space-y-4" title="Your domains">
          {domains.map((d) => (
            <div key={d.id} className="rounded-xl border border-zinc-100 bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">{d.domain}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.status === "VERIFIED"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {d.status === "VERIFIED" ? "Live" : "Pending"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {d.status !== "VERIFIED" ? (
                    <form action={verifyDomainAction.bind(null, d.id)}>
                      <button className="font-medium text-brand-strong underline">Verify</button>
                    </form>
                  ) : null}
                  <form action={deleteDomainAction.bind(null, d.id)}>
                    <button className="text-muted underline hover:text-red-700">Remove</button>
                  </form>
                </div>
              </div>

              {d.status !== "VERIFIED" ? (
                <div className="mt-3 space-y-2 rounded-lg bg-zinc-50 p-3 text-xs text-muted">
                  <p className="font-medium text-zinc-900">Add these DNS records, then click Verify:</p>
                  <div>
                    <span className="font-semibold">1. TXT</span> — host{" "}
                    <code className="rounded bg-surface px-1 py-0.5">_invoxai-challenge.{d.domain}</code>{" "}
                    value <code className="rounded bg-surface px-1 py-0.5">{d.verifyToken}</code>
                  </div>
                  <div>
                    <span className="font-semibold">2. A</span> — host{" "}
                    <code className="rounded bg-surface px-1 py-0.5">{d.domain}</code> →{" "}
                    <code className="rounded bg-surface px-1 py-0.5">{aTarget}</code>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </GlassCard>
      ) : (
        <GlassCard className="mt-6">
          <p className="text-sm text-muted">No domains added yet.</p>
        </GlassCard>
      )}
    </div>
  );
}
