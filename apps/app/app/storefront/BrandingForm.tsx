"use client";

import { useActionState } from "react";
import { ImageUpload } from "@invoxai/ui";
import { saveBrandingAction, type StorefrontFormState } from "./actions";
import { uploadTenantImageAction } from "../upload-actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export interface BrandingInitial {
  logoUrl: string;
  bannerUrl: string;
  brandColor: string;
  aboutText: string;
  privacyUrl: string;
  refundUrl: string;
  termsUrl: string;
  storeMetaTitle: string;
  storeMetaDescription: string;
}

export function BrandingForm({ initial }: { initial: BrandingInitial }) {
  const [state, action, pending] = useActionState<StorefrontFormState, FormData>(saveBrandingAction, {});

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="text-sm font-medium text-zinc-900">Store logo</span>
          <div className="mt-1">
            <ImageUpload name="logoUrl" defaultValue={initial.logoUrl} action={uploadTenantImageAction} recommend="Square logo works best." />
          </div>
        </div>
        <div>
          <span className="text-sm font-medium text-zinc-900">Hero banner</span>
          <div className="mt-1">
            <ImageUpload name="bannerUrl" defaultValue={initial.bannerUrl} action={uploadTenantImageAction} recommend="Wide image shown atop your store." />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        Brand colour
        <input
          type="color"
          name="brandColor"
          defaultValue={/^#[0-9a-fA-F]{6}$/.test(initial.brandColor) ? initial.brandColor : "#7c3aed"}
          className="h-8 w-12 cursor-pointer rounded border border-zinc-300"
        />
        <span className="text-xs font-normal text-muted">Accent used on your storefront.</span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">About the seller</span>
        <textarea name="aboutText" defaultValue={initial.aboutText} rows={3} maxLength={1000} placeholder="Tell buyers who you are and what you offer." className={inputCls} />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Privacy policy URL</span>
          <input name="privacyUrl" defaultValue={initial.privacyUrl} placeholder="https://… or /privacy" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Refund policy URL</span>
          <input name="refundUrl" defaultValue={initial.refundUrl} placeholder="https://… or /refunds" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-900">Terms URL</span>
          <input name="termsUrl" defaultValue={initial.termsUrl} placeholder="https://… or /terms" className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Store SEO title</span>
        <input name="storeMetaTitle" defaultValue={initial.storeMetaTitle} maxLength={200} placeholder="Shown in Google + browser tab" className={inputCls} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Store SEO description</span>
        <textarea name="storeMetaDescription" defaultValue={initial.storeMetaDescription} rows={2} maxLength={300} placeholder="A one-line summary for search results." className={inputCls} />
      </label>

      {state.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state.ok ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved ✓</p> : null}
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
