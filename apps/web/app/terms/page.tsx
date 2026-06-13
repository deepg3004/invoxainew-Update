import type { Metadata } from "next";
import { getCompany } from "../lib/company";
import { LegalShell, LegalSection } from "../legal/LegalShell";

export const revalidate = 600;
export const metadata: Metadata = { title: "Terms of Service · InvoxAI" };

export default async function TermsPage() {
  const c = await getCompany();
  return (
    <LegalShell title="Terms of Service" effectiveDate={c.effectiveDate}>
      <p>
        These Terms of Service (“Terms”) govern your access to and use of InvoxAI (the
        “Platform”), operated by {c.legalName} (“we”, “us”). By creating an account or using
        the Platform you agree to these Terms. If you do not agree, do not use the Platform.
      </p>

      <LegalSection heading="1. What InvoxAI is">
        <p>
          InvoxAI is a software platform that lets creators and businesses (“Sellers”) build
          websites, stores, courses, payment pages and communities, and accept payments through
          the Seller’s own connected payment gateway. <strong>InvoxAI does not act as a
          merchant, marketplace of record, or payment aggregator for Seller sales</strong> —
          buyer payments for a Seller’s products settle directly to that Seller’s own gateway
          account. We are a technology provider only.
        </p>
      </LegalSection>

      <LegalSection heading="2. Accounts">
        <p>
          You must provide accurate information, keep your credentials secure, and are
          responsible for all activity under your account. You must be legally capable of
          entering into a contract and comply with all laws applicable to your business.
        </p>
      </LegalSection>

      <LegalSection heading="3. Fees, wallet and commission">
        <p>
          Use of the Platform may require a paid subscription and/or per-feature charges (for
          example, AI page generation). We charge a platform commission on Seller sales, which
          is deducted from the Seller’s prepaid InvoxAI wallet. You authorise us to collect
          these amounts via our own payment gateway. Plan prices, commission rates and feature
          charges are shown in your dashboard and may change on prospective notice. Taxes (e.g.
          GST) apply where required.
        </p>
      </LegalSection>

      <LegalSection heading="4. Seller responsibilities">
        <p>
          Sellers are solely responsible for their products, content, pricing, fulfilment,
          customer service, refunds, taxes, and compliance with applicable law. You represent
          that you have all rights necessary to sell what you list and that your offerings are
          lawful.
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>You agree not to use the Platform to offer or do any of the following:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>fraud, scams, or deceptive or misleading offers;</li>
          <li>illegal goods or services, weapons, or regulated items without authorisation;</li>
          <li>gambling/betting, adult content, pirated content, or unlicensed financial or medical claims;</li>
          <li>infringing intellectual property, or violating others’ privacy;</li>
          <li>malware, abuse of the Platform, or attempts to circumvent security or fees.</li>
        </ul>
        <p>
          We may review reported stores and remove content, suspend or terminate accounts that
          violate these Terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="6. Buyer transactions">
        <p>
          A purchase from a Seller is a contract between the buyer and that Seller. Because buyer
          funds settle to the Seller’s own gateway, refunds and disputes for Seller sales are
          handled by the Seller. See our <a className="underline" href="/refund-policy">Refund &
          Cancellation Policy</a> for how this works and for refunds of InvoxAI’s own charges.
        </p>
      </LegalSection>

      <LegalSection heading="7. Suspension & termination">
        <p>
          We may suspend or terminate access for breach of these Terms, risk or abuse signals,
          legal requirement, or non-payment. You may stop using the Platform at any time.
          Outstanding fees remain payable.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers & limitation of liability">
        <p>
          The Platform is provided “as is” without warranties of any kind. To the maximum extent
          permitted by law, we are not liable for indirect, incidental or consequential damages,
          and our total liability for any claim is limited to the platform fees you paid to us in
          the three months before the event giving rise to the claim.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes">
        <p>
          We may update these Terms from time to time. Material changes will be notified in the
          dashboard or by email; continued use after changes take effect constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing law">
        <p>
          These Terms are governed by the laws of India, and the courts at our registered place
          of business have exclusive jurisdiction, subject to applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          {c.legalName}
          {c.gstin ? ` · GSTIN ${c.gstin}` : ""}
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
