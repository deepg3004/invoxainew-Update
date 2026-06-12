"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@invoxai/auth/client";

type Step = "email" | "otp";

/**
 * Buyer sign-in on the tenant subdomain. Same Supabase email-OTP + Google flow
 * as sellers, but the session is scoped to this seller's subdomain (separate
 * cookie domain). redirectTo uses window.location.origin so it returns to THIS
 * tenant — which must be allow-listed in Supabase (https://*.invoxai.io/**).
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/account";
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const emailRedirectTo = `${window.location.origin}/account/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const redirectTo = `${window.location.origin}/account/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        Buyer sign in
      </p>
      <h1 className="mt-1 text-2xl font-bold">Access your orders</h1>

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {step === "email" ? (
        <form onSubmit={sendOtp} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/10 px-3 py-2 outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="mt-6 space-y-3">
          <p className="text-sm text-muted">
            Enter the 6-digit code we sent to <strong>{email}</strong>.
          </p>
          <input
            inputMode="numeric"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-lg border border-white/10 px-3 py-2 tracking-widest outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="w-full text-sm text-muted underline"
          >
            Use a different email
          </button>
        </form>
      )}

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-white/10" /> or{" "}
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full rounded-lg border border-white/10 px-3 py-2 font-medium hover:bg-white/5 disabled:opacity-50"
      >
        Continue with Google
      </button>
    </main>
  );
}
