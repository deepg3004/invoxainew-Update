"use client";

import { useActionState } from "react";
import { connectGateway } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export function GatewayForm() {
  const [state, formAction, pending] = useActionState(connectGateway, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-lg bg-zinc-50 p-4 text-sm text-muted">
        Find these in your Razorpay Dashboard → <strong>Settings → API Keys</strong>.
        Use <code>rzp_test_…</code> keys to trial, or <code>rzp_live_…</code> for
        real payments. We verify the keys with Razorpay and store your secret
        encrypted — it’s never shown again.
      </div>

      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Gateway connected.
        </p>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Key ID</span>
        <input
          name="keyId"
          required
          autoComplete="off"
          placeholder="rzp_test_xxxxxxxxxxxx"
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-900">Key Secret</span>
        <input
          name="keySecret"
          required
          type="password"
          autoComplete="off"
          placeholder="••••••••••••••••"
          className={inputCls}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Verifying…" : "Connect Razorpay"}
      </button>
    </form>
  );
}
