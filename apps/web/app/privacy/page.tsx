import type { Metadata } from "next";
import { getCompany } from "../lib/company";
import { LegalShell, LegalSection } from "../legal/LegalShell";

export const revalidate = 600;
export const metadata: Metadata = { title: "Privacy Policy · InvoxAI" };

export default async function PrivacyPage() {
  const c = await getCompany();
  return (
    <LegalShell title="Privacy Policy" effectiveDate={c.effectiveDate}>
      <p>
        This Privacy Policy explains how {c.legalName} (“we”, “us”) collects, uses and protects
        information when you use InvoxAI (the “Platform”). It applies to Sellers who use our
        dashboard and to buyers who interact with Seller storefronts hosted on the Platform.
      </p>

      <LegalSection heading="1. Information we collect">
        <ul className="list-disc space-y-1 pl-6">
          <li><strong>Account data:</strong> name, email, business details and login identifiers.</li>
          <li><strong>Transaction data:</strong> order and payment metadata (amounts, status, references). We do not store full card or bank credentials — payments are processed by payment gateways.</li>
          <li><strong>Gateway credentials:</strong> a Seller’s payment-gateway secret is stored encrypted (AES‑256‑GCM) and is never shown to other users or to our staff in plaintext.</li>
          <li><strong>Usage & device data:</strong> pages viewed, approximate analytics, cookies, and similar technical data.</li>
          <li><strong>Content you provide:</strong> products, pages, communities, messages and uploads.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. How we use information">
        <p>
          To provide and operate the Platform; process platform fees, wallet and commission;
          generate AI content you request; secure the service and prevent fraud/abuse; provide
          support; send service and transactional communications; and comply with law.
        </p>
      </LegalSection>

      <LegalSection heading="3. Service providers we share with">
        <p>We use trusted processors to run the service, including:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Supabase (database, authentication and file storage);</li>
          <li>Razorpay and Sellers’ own connected gateways (payments);</li>
          <li>Anthropic (AI page generation, on your request);</li>
          <li>email/notification providers (transactional email);</li>
          <li>hosting and analytics infrastructure.</li>
        </ul>
        <p>
          We share only what is needed for these services to function. We do not sell your
          personal information.
        </p>
      </LegalSection>

      <LegalSection heading="4. Seller and buyer data">
        <p>
          A Seller can see data about buyers who interact with that Seller’s own store (e.g.
          their orders). Buyers see only their own data. Sellers act as the controller of their
          customers’ data and are responsible for their own privacy practices; we process that
          data on their behalf as part of providing the Platform.
        </p>
      </LegalSection>

      <LegalSection heading="5. Cookies & tracking">
        <p>
          We and Sellers use cookies and similar technologies for sessions, security, analytics
          and (on Seller pages, where configured by the Seller) advertising pixels such as Meta
          Pixel, Google Ads and GA4. You can control cookies through your browser settings.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data retention & security">
        <p>
          We retain information for as long as needed to provide the service and meet legal
          obligations. We apply administrative and technical safeguards (encryption of secrets,
          access controls, row-level security). No method of transmission or storage is fully
          secure, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="7. Your rights">
        <p>
          Subject to applicable law, you may request access, correction or deletion of your
          personal information, or object to certain processing. Contact us using the details
          below. Buyers should also contact the relevant Seller for data the Seller controls.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes">
        <p>
          We may update this Policy; material changes will be notified in the dashboard or by
          email. Continued use after changes take effect constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection heading="9. Contact">
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
