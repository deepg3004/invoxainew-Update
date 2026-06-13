import type { Metadata } from "next";
import { getCompany } from "../lib/company";
import { LegalShell, LegalSection } from "../legal/LegalShell";

export const revalidate = 600;
export const metadata: Metadata = { title: "Contact Us · InvoxAI" };

export default async function ContactPage() {
  const c = await getCompany();
  return (
    <LegalShell title="Contact Us" effectiveDate={c.effectiveDate}>
      <p>We’re here to help. Reach us using the details below and we’ll get back to you.</p>

      <LegalSection heading="Support">
        <p>
          Email: <a className="underline" href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>
          {c.phone ? (
            <>
              <br />
              Phone: {c.phone}
            </>
          ) : null}
          <br />
          We aim to respond within 1–2 business days.
        </p>
      </LegalSection>

      <LegalSection heading="Business details">
        <p>
          {c.legalName}
          <br />
          {c.address}
          {c.gstin ? (
            <>
              <br />
              GSTIN: {c.gstin}
            </>
          ) : null}
        </p>
      </LegalSection>

      <LegalSection heading="Grievance officer">
        <p>
          In accordance with applicable Indian law (including the Information Technology Act,
          2000 and rules thereunder), grievances regarding content or use of the Platform may be
          sent to our Grievance Officer at{" "}
          <a className="underline" href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>. Please
          include details of your concern so we can address it; we will acknowledge within the
          timelines required by law.
        </p>
      </LegalSection>

      <LegalSection heading="Report a store">
        <p>
          To report a store for fraud or prohibited content, use the “Report this store” link in
          the footer of any InvoxAI storefront, or email us at the address above.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
