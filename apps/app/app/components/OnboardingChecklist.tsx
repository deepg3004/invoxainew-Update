import Link from "next/link";
import type { OnboardingStatus } from "@invoxai/db";

/**
 * Dashboard get-started checklist (activation). Shows the key setup steps with
 * their done state + a quick action; hides entirely once all are complete so it
 * doesn't nag established sellers.
 */
export function OnboardingChecklist({ status }: { status: OnboardingStatus }) {
  const steps = [
    {
      done: status.hasSubscription,
      label: "Choose a plan",
      hint: "Pick Free or a paid plan to set your limits & commission.",
      href: "/billing",
    },
    {
      done: status.gatewayConnected,
      label: "Connect your payment gateway",
      hint: "Link your Razorpay so buyers pay you directly.",
      href: "/gateway",
    },
    {
      done: status.hasPaymentPage,
      label: "Create a payment page",
      hint: "A shareable link buyers can pay you through.",
      href: "/pay-pages/new",
    },
    {
      done: status.hasWalletBalance,
      label: "Top up your wallet",
      hint: "Covers InvoxAI fees (commission, AI pages).",
      href: "/wallet",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900">Finish setting up</h2>
        <span className="text-sm font-medium text-brand-strong">
          {doneCount}/{steps.length} done
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full bg-brand"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                s.done ? "bg-success text-white" : "border border-zinc-200 text-transparent"
              }`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <span className={s.done ? "text-muted line-through" : "font-medium text-zinc-900"}>
                {s.label}
              </span>
              {!s.done ? (
                <span className="text-muted"> — {s.hint}</span>
              ) : null}
            </div>
            {!s.done ? (
              <Link href={s.href} className="shrink-0 text-sm font-medium text-brand-strong underline">
                Do it →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
