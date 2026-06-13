import type { ReactNode } from "react";
import Link from "next/link";

/** Shared chrome for the legal pages — a readable prose column + back link. */
export function LegalShell({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 underline hover:text-zinc-900">
        ← InvoxAI
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-zinc-900">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">Last updated: {effectiveDate}</p>
      <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-zinc-700">
        {children}
      </div>
      <div className="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-500">
        <Link href="/terms" className="underline hover:text-zinc-900">Terms</Link>
        {" · "}
        <Link href="/privacy" className="underline hover:text-zinc-900">Privacy</Link>
        {" · "}
        <Link href="/refund-policy" className="underline hover:text-zinc-900">Refunds</Link>
        {" · "}
        <Link href="/contact" className="underline hover:text-zinc-900">Contact</Link>
      </div>
    </main>
  );
}

/** A titled section within a legal document. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-900">{heading}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
