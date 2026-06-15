import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCertificateBySerial } from "@invoxai/db";
import { formatDateIST } from "@invoxai/utils/date";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serial: string }>;
}): Promise<Metadata> {
  const { serial } = await params;
  const cert = await getCertificateBySerial(serial);
  if (!cert) return { title: "Certificate not found" };
  return {
    title: `Certificate · ${cert.course.title}`,
    description: `${cert.recipientName} completed ${cert.course.title}.`,
  };
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  const cert = await getCertificateBySerial(serial);
  if (!cert) notFound();

  const store = cert.tenant.name?.trim() || cert.tenant.username;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-4 flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
        <span>✓</span> Verified certificate
      </div>

      <div className="rounded-2xl border-4 border-double border-brand/40 bg-white p-10 text-center shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          Certificate of Completion
        </p>
        <p className="mt-8 text-sm text-muted">This certifies that</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-zinc-900">{cert.recipientName}</h1>
        <p className="mt-6 text-sm text-muted">has successfully completed</p>
        <h2 className="mt-2 text-xl font-semibold text-brand-strong">{cert.course.title}</h2>

        <div className="mt-10 flex items-end justify-between border-t border-zinc-200 pt-5 text-left text-xs text-muted">
          <div>
            <div className="font-medium text-zinc-700">{store}</div>
            <div>Issued {formatDateIST(cert.issuedAt)}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[11px] tracking-wide text-zinc-700">{cert.serial}</div>
            <div>Verification ID</div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        This certificate is genuine — its presence at this verification link confirms it was issued by {store} via InvoxAI.
      </p>
    </main>
  );
}
