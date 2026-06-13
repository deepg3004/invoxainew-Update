"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { formatRupees } from "@invoxai/utils/money";
import { submitUpiRef } from "./upi-actions";
import type { StartUpiSessionResult } from "../lib/upi";

/**
 * The post-submit "pending confirmation" card, shown when an order is HELD for the
 * seller to confirm manually (auto-confirm off / above the seller's cap / the
 * seller is dues-blocked). Deliberately NOT a success state — the buyer paid the
 * seller's UPI directly and a human still has to confirm.
 */
export function UpiSubmitted() {
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
      <p className="font-display text-lg font-semibold text-zinc-900">Payment submitted</p>
      <p className="mt-1 text-sm text-amber-800">
        The seller will verify your UPI payment and confirm your order shortly. It’ll appear in
        your orders once confirmed.
      </p>
      <a
        href="/account"
        className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white"
      >
        Go to your orders
      </a>
    </div>
  );
}

type Session = { buyerPaymentId: string; payAmountPaise: number; expiresAt: number };
type Phase = "idle" | "starting" | "session" | "submitting";

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Two-step manual-UPI checkout: (1) "Pay by UPI" starts a server session that
 * reserves a UNIQUE payable amount; (2) the buyer pays that exact amount (scan the
 * dynamic QR / open their UPI app / copy the id), pastes the reference, and we
 * auto-confirm instantly (or hold for the seller). The amount + tenant are
 * server-trusted; the QR amount is the unique `payAmountPaise`. The session has a
 * countdown — once it expires the buyer starts again (its amount is freed).
 *
 * `onConfirmed` fires on instant auto-confirm (parent shows its success state);
 * `onSubmitted` fires when the order is held pending (parent shows <UpiSubmitted/>).
 */
export function UpiPayPanel({
  upi,
  title,
  onStart,
  onConfirmed,
  onSubmitted,
}: {
  upi: { upiId: string; payeeName: string };
  title: string;
  onStart: () => Promise<StartUpiSessionResult>;
  onConfirmed: () => void;
  onSubmitted: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<Session | null>(null);
  const [upiRefInput, setUpiRefInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tick the countdown only while a session is open.
  useEffect(() => {
    if (phase !== "session") return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [phase]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const expired = session != null && now >= session.expiresAt;

  async function start() {
    setError(null);
    setPhase("starting");
    try {
      const res = await onStart();
      if (!res.ok) {
        setError(res.error);
        setPhase("idle");
        return;
      }
      setSession({
        buyerPaymentId: res.buyerPaymentId,
        payAmountPaise: res.payAmountPaise,
        expiresAt: new Date(res.expiresAt).getTime(),
      });
      setUpiRefInput("");
      setNow(Date.now());
      setPhase("session");
    } catch {
      setError("Couldn’t start the payment. Please try again.");
      setPhase("idle");
    }
  }

  async function submit() {
    if (!session) return;
    setError(null);
    setPhase("submitting");
    try {
      const res = await submitUpiRef(session.buyerPaymentId, upiRefInput.trim());
      if (res.ok) {
        if (res.confirmed) onConfirmed();
        else onSubmitted();
        return;
      }
      setError(res.error);
      if (res.expired) {
        setSession(null);
        setPhase("idle");
      } else {
        setPhase("session");
      }
    } catch {
      setError("Couldn’t submit. Please try again.");
      setPhase("session");
    }
  }

  function copyUpiId() {
    navigator.clipboard?.writeText(upi.upiId).then(
      () => {
        setCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  // ── Idle: the entry button (and any start error) ──
  if (phase === "idle" || phase === "starting") {
    return (
      <div className="mt-3">
        {error ? (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <button
          onClick={start}
          disabled={phase === "starting"}
          className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {phase === "starting" ? "Starting…" : "Pay by UPI"}
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          Scan a QR or pay to a UPI ID, then confirm with your transaction reference.
        </p>
      </div>
    );
  }

  // ── Session open ──
  const payAmount = session!.payAmountPaise;
  const upiLink = `upi://pay?pa=${encodeURIComponent(upi.upiId)}&pn=${encodeURIComponent(
    upi.payeeName,
  )}&am=${(payAmount / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(title)}`;

  if (expired) {
    return (
      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
        <p className="text-sm font-medium text-zinc-900">This payment session expired.</p>
        <p className="mt-1 text-xs text-muted">Start again to get a fresh amount and QR.</p>
        <button
          onClick={start}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          Start again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Exact amount + countdown */}
      <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 text-center">
        <p className="text-xs text-muted">Pay exactly</p>
        <p className="font-display text-2xl font-bold text-zinc-900">{formatRupees(payAmount)}</p>
        <p className="mt-0.5 text-xs text-muted">
          Expires in <span className="font-mono font-medium">{mmss(session!.expiresAt - now)}</span>
        </p>
      </div>

      {/* Dynamic QR (scan on desktop / second device) */}
      <div className="flex justify-center">
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <QRCode value={upiLink} size={168} />
        </div>
      </div>

      {/* UPI id + copy + open-app (mobile) */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
        <p className="text-muted">UPI ID</p>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-base font-semibold text-zinc-900">{upi.upiId}</span>
          <button
            type="button"
            onClick={copyUpiId}
            className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-brand/40"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-0.5 text-xs text-muted">{upi.payeeName}</p>
        <a
          href={upiLink}
          className="mt-2 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white sm:hidden"
        >
          Open UPI app
        </a>
      </div>

      {/* Step-by-step guide */}
      <ol className="space-y-1 rounded-lg bg-zinc-50 p-3 text-xs text-muted">
        <li>
          <span className="font-medium text-zinc-700">1.</span>{" "}
          <span className="sm:hidden">Tap “Open UPI app”, or scan the QR with another phone.</span>
          <span className="hidden sm:inline">Scan the QR with your UPI app (GPay / PhonePe / Paytm).</span>
        </li>
        <li>
          <span className="font-medium text-zinc-700">2.</span> Pay the{" "}
          <span className="font-medium text-zinc-700">exact</span> amount shown above.
        </li>
        <li>
          <span className="font-medium text-zinc-700">3.</span> Copy the UPI reference / UTR from
          your app’s success screen.
        </li>
        <li>
          <span className="font-medium text-zinc-700">4.</span> Paste it below and tap “I’ve paid”.
        </li>
      </ol>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <input
        value={upiRefInput}
        onChange={(e) => setUpiRefInput(e.target.value)}
        placeholder="UPI transaction reference (UTR)"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
      />
      <button
        onClick={submit}
        disabled={phase === "submitting" || upiRefInput.trim().length < 6}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {phase === "submitting" ? "Confirming…" : "I’ve paid — submit"}
      </button>
    </div>
  );
}
