import { getPricingSetting } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
import { AiPageForm } from "../AiPageForm";

export const dynamic = "force-dynamic";

export default async function NewAiPage() {
  await requireTenant();
  const setting = await getPricingSetting("ai_page_price");
  const priceLabel = formatRupees(setting?.valuePaise ?? 14900);

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">Generate an AI page</h1>
      <p className="mt-1 text-neutral-500">
        AI writes the copy from your brief and publishes it on your site. The fee
        ({priceLabel}) is charged from your wallet only if generation succeeds.
      </p>
      <div className="mt-6">
        <AiPageForm priceLabel={priceLabel} />
      </div>
    </main>
  );
}
