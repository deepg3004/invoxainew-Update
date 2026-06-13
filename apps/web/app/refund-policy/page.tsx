import type { Metadata } from "next";
import { getCompany } from "../lib/company";
import { LegalShell, LegalSection } from "../legal/LegalShell";

export const revalidate = 600;
export const metadata: Metadata = { title: "Refund & Cancellation Policy · InvoxAI" };

export default async function RefundPolicyPage() {
  const c = await getCompany();
  return (
    <LegalShell title="Refund & Cancellation Policy" effectiveDate={c.effectiveDate}>
      <p>
        This policy explains refunds and cancellations for two different kinds of payments on
        InvoxAI, operated by {c.legalName}. Please read the section that applies to you.
      </p>

      <LegalSection heading="1. Purchases you make from a Seller">
        <p>
          When you buy a product, course, community or other offering from a Seller’s store, your
          payment goes <strong>directly to that Seller through the Seller’s own payment
          gateway</strong> — InvoxAI does not receive or hold those funds. As a result, refunds,
          cancellations, delivery and disputes for Seller purchases are handled by the Seller
          under the Seller’s own terms.
        </p>
        <p>
          To request a refund for something you bought from a store, contact that Seller directly
          (their contact details are on their store or your order receipt). If you cannot reach a
          Seller, you may also write to us at{" "}
          <a className="underline" href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> and we
          will try to help facilitate, but the refund decision and processing rest with the
          Seller.
        </p>
      </LegalSection>

      <LegalSection heading="2. Payments you make to InvoxAI">
        <p>This covers our own charges: subscriptions, wallet recharges and feature fees.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Subscriptions:</strong> plan fees are billed in advance for the chosen period
            and are generally non-refundable once the period has begun, except where required by
            law. You can cancel renewal at any time to stop future charges.
          </li>
          <li>
            <strong>Wallet recharges:</strong> wallet balance is used to pay platform commission
            and feature charges. Unused wallet balance may be refundable on account closure,
            subject to deduction of any amounts due and applicable processing limits; contact us
            to request this.
          </li>
          <li>
            <strong>Feature fees (e.g. AI page generation):</strong> these are charged when the
            feature is successfully used and are non-refundable once delivered. If a charge was
            taken but the feature failed to deliver, we will re-attempt or refund that charge.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Digital delivery">
        <p>
          Most offerings on InvoxAI are digital (access, downloads, generated pages) and are
          delivered immediately or shortly after payment. Where access is granted, the service is
          considered delivered.
        </p>
      </LegalSection>

      <LegalSection heading="4. How to request a refund of an InvoxAI charge">
        <p>
          Email{" "}
          <a className="underline" href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a> from
          your account email with the payment reference and reason. Eligible refunds are
          processed to the original payment method, typically within 5–7 business days after
          approval.
        </p>
      </LegalSection>

      <LegalSection heading="5. Contact">
        <p>
          {c.legalName}
          <br />
          {c.address}
          <br />
          Email: <a className="underline" href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>
          {c.phone ? <> · Phone: {c.phone}</> : null}
        </p>
      </LegalSection>
    </LegalShell>
  );
}
