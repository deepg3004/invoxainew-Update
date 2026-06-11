"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@invoxai/auth/client";

type Step = "email" | "otp";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
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
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Works two ways: the email contains a 6-digit code (enter it below) AND
      // a magic link that lands on /auth/callback. Either completes sign-in.
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
    // Session cookie is now set; navigate and let middleware/page route us.
    router.push(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
    // On success the browser is redirected to Google.
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        InvoxAI
      </p>
      <h1 className="mt-1 text-2xl font-bold">Sign in to your dashboard</h1>

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
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="mt-6 space-y-3">
          <p className="text-sm text-neutral-500">
            Enter the 6-digit code we sent to <strong>{email}</strong>.
          </p>
          <input
            inputMode="numeric"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 tracking-widest outline-none focus:border-neutral-900"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="w-full text-sm text-neutral-500 underline"
          >
            Use a different email
          </button>
        </form>
      )}

      <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" /> or{" "}
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        Continue with Google
      </button>
    </main>
  );
}
