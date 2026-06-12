import { Card } from "@invoxai/ui";
import { listDomains } from "@invoxai/db";
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
  const [domains, { msg }] = await Promise.all([listDomains(tenant.id), searchParams]);
  const aTarget = serverEnv().CUSTOM_DOMAIN_A_TARGET;
  const banner = msg ? MSG[msg] : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">InvoxAI</p>
      <h1 className="mt-1 text-3xl font-bold">Custom domains</h1>
      <p className="mt-1 text-neutral-500">
        Serve your site on your own domain. Your default address
        ({tenant.username}.invoxai.io) keeps working too.
      </p>

      {banner ? (
        <p
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            banner.tone === "ok" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {banner.text}
        </p>
      ) : null}

      <div className="mt-6">
        <Card title="Add a domain">
          <AddDomainForm />
        </Card>
      </div>

      {domains.length > 0 ? (
        <div className="mt-6 space-y-4">
          {domains.map((d) => (
            <div key={d.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900">{d.domain}</span>
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
                      <button className="font-medium text-blue-600 underline">Verify</button>
                    </form>
                  ) : null}
                  <form action={deleteDomainAction.bind(null, d.id)}>
                    <button className="text-neutral-400 underline hover:text-red-700">Remove</button>
                  </form>
                </div>
              </div>

              {d.status !== "VERIFIED" ? (
                <div className="mt-3 space-y-2 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
                  <p className="font-medium text-neutral-700">Add these DNS records, then click Verify:</p>
                  <div>
                    <span className="font-semibold">1. TXT</span> — host{" "}
                    <code className="rounded bg-white px-1 py-0.5">_invoxai-challenge.{d.domain}</code>{" "}
                    value <code className="rounded bg-white px-1 py-0.5">{d.verifyToken}</code>
                  </div>
                  <div>
                    <span className="font-semibold">2. A</span> — host{" "}
                    <code className="rounded bg-white px-1 py-0.5">{d.domain}</code> →{" "}
                    <code className="rounded bg-white px-1 py-0.5">{aTarget}</code>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-neutral-500">No domains added yet.</p>
      )}
    </main>
  );
}
