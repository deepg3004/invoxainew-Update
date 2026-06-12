"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsFormState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export type SettingsInitial = {
  invoice_legal_name: string;
  invoice_gstin: string;
  invoice_address: string;
  invoice_gst_rate_percent: string;
  brand_logo_url: string;
  brand_favicon_url: string;
  // Env fallbacks shown as placeholders so admin sees what's currently in effect.
  ph_legal_name: string;
  ph_gstin: string;
  ph_gst_percent: string;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-900">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(
    saveSettingsAction,
    {},
  );

  return (
    <form action={action} className="space-y-8">
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-zinc-900">Invoice &amp; GST</h2>
        <p className="mt-1 text-sm text-muted">
          Printed on every tax invoice. Until a GSTIN is set, invoices render as DRAFT
          (not valid tax invoices). The GST rate applies to invoices issued from now on —
          past invoices keep the rate they were issued at.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Legal name">
            <input name="invoice_legal_name" defaultValue={initial.invoice_legal_name} placeholder={initial.ph_legal_name} className={inputCls} />
          </Field>
          <Field label="GSTIN" hint="15-character GSTIN, e.g. 27ABCDE1234F1Z5. Leave blank for DRAFT invoices.">
            <input name="invoice_gstin" defaultValue={initial.invoice_gstin} placeholder={initial.ph_gstin || "Not set — invoices are DRAFT"} className={`${inputCls} font-mono uppercase`} />
          </Field>
          <Field label="GST rate (%)" hint="0–28. Default 18.">
            <input name="invoice_gst_rate_percent" defaultValue={initial.invoice_gst_rate_percent} placeholder={initial.ph_gst_percent} inputMode="decimal" className={inputCls} />
          </Field>
          <Field label="Registered address" hint="Shown in the invoice 'From' block.">
            <textarea name="invoice_address" defaultValue={initial.invoice_address} rows={3} className={inputCls} />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-zinc-900">Branding</h2>
        <p className="mt-1 text-sm text-muted">
          Paste hosted image URLs (https). The logo appears on tax invoices and the
          marketing site; the favicon is the browser-tab icon on invoxai.io.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Logo URL" hint="Wide/transparent PNG or SVG works best.">
            <input name="brand_logo_url" defaultValue={initial.brand_logo_url} placeholder="https://…/logo.png" className={inputCls} />
          </Field>
          <Field label="Favicon URL" hint="Square icon (32×32 or 512×512).">
            <input name="brand_favicon_url" defaultValue={initial.brand_favicon_url} placeholder="https://…/favicon.png" className={inputCls} />
          </Field>
        </div>
        {initial.brand_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.brand_logo_url} alt="Current logo" className="mt-4 h-10 w-auto" />
        ) : null}
      </section>

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Settings saved ✓</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
