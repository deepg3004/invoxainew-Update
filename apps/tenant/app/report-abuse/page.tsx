import { headers } from "next/headers";
import { resolveTenantByHost } from "../../lib/resolve";
import { ReportForm } from "./ReportForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Report this store · InvoxAI",
  robots: { index: false },
};

export default async function ReportAbusePage() {
  const tenant = await resolveTenantByHost((await headers()).get("host"));
  const storeName = tenant ? tenant.name?.trim() || tenant.username : null;

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-900">Report this store</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {storeName
          ? `Tell us what's wrong with ${storeName}. `
          : "Tell us what's wrong with this store. "}
        Reports are confidential and reviewed by InvoxAI’s safety team. InvoxAI hosts
        independent sellers — reporting helps us keep the platform safe.
      </p>

      {tenant ? (
        <ReportForm />
      ) : (
        <p className="mt-6 text-sm text-zinc-500">This store could not be found.</p>
      )}
    </main>
  );
}
