import Link from "next/link";
import {
  Globe,
  BadgeCheck,
  Gauge,
  Coins,
  Receipt,
  FileText,
  Plug,
  ShieldCheck,
  User as UserIcon,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard, PageHeader, Button, Badge } from "@invoxai/ui";
import { requireTenant } from "../../lib/tenant";
import { updateProfileAction, changePasswordAction } from "./actions";

export const dynamic = "force-dynamic";

const MSG: Record<string, { text: string; tone: "ok" | "err" }> = {
  name_saved: { text: "Profile name updated.", tone: "ok" },
  name_invalid: { text: "Name must be 2–80 characters.", tone: "err" },
  pw_saved: { text: "Password changed — use it next time you sign in.", tone: "ok" },
  pw_short: { text: "Password must be at least 8 characters.", tone: "err" },
  pw_mismatch: { text: "The two passwords don’t match.", tone: "err" },
  pw_failed: { text: "We couldn’t change the password. Please sign in again and retry.", tone: "err" },
};

type LinkRow = { href: string; label: string; desc: string; icon: LucideIcon };

const SECTIONS: { heading: string; rows: LinkRow[] }[] = [
  {
    heading: "Account & business",
    rows: [
      { href: "/verification", label: "Verified", desc: "KYC & business verification badge", icon: BadgeCheck },
      { href: "/invoices", label: "Tax invoices", desc: "GST invoices for your payouts & charges", icon: FileText },
    ],
  },
  {
    heading: "Billing & payments",
    rows: [
      { href: "/billing", label: "Billing", desc: "Plan, billing form & payment method", icon: Receipt },
      { href: "/gateway", label: "Gateways", desc: "Connect your own payment gateway", icon: Plug },
      { href: "/feature-payments", label: "Feature charges", desc: "Pay-as-you-go feature usage charges", icon: Coins },
    ],
  },
  {
    heading: "Site & limits",
    rows: [
      { href: "/domains", label: "Custom domains", desc: "Serve your site on your own domain", icon: Globe },
      { href: "/usage", label: "Usage & limits", desc: "Plan limits and current usage", icon: Gauge },
    ],
  },
];

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand-strong/20";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ tenant, user }, { msg }] = await Promise.all([requireTenant(), searchParams]);
  const banner = msg ? MSG[msg] : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="InvoxAI"
        title="Settings"
        description={
          <>
            Manage your account, billing, domains and security. Your workspace lives at{" "}
            <span className="font-medium text-zinc-700">{tenant.username}.invoxai.io</span>.
          </>
        }
      />

      {banner ? (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            banner.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      {/* Quick links to existing settings surfaces */}
      <div className="grid gap-6 md:grid-cols-3">
        {SECTIONS.map((s) => (
          <GlassCard key={s.heading} className="p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{s.heading}</h2>
            <ul className="space-y-1">
              {s.rows.map((r) => {
                const Icon = r.icon;
                return (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-zinc-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gradient/10 text-brand-strong">
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-zinc-900">{r.label}</span>
                        <span className="block truncate text-xs text-zinc-500">{r.desc}</span>
                      </span>
                      <ChevronRight size={16} className="text-zinc-300 transition group-hover:text-zinc-500" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        ))}
      </div>

      {/* Profile */}
      <GlassCard id="profile" className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserIcon size={18} className="text-brand-strong" />
          <h2 className="text-base font-semibold text-zinc-900">Profile</h2>
        </div>
        <form action={updateProfileAction} className="grid max-w-md gap-4">
          <label className="block text-sm text-zinc-600">
            Display name
            <input name="name" defaultValue={tenant.name ?? ""} maxLength={80} required className={inputCls} />
          </label>
          <label className="block text-sm text-zinc-600">
            Email
            <input value={user.email ?? ""} disabled className={`${inputCls} cursor-not-allowed bg-zinc-50 text-zinc-500`} />
            <span className="mt-1 block text-xs text-zinc-400">Contact support to change your sign-in email.</span>
          </label>
          <div>
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </GlassCard>

      {/* Security */}
      <GlassCard id="security" className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-brand-strong" />
          <h2 className="text-base font-semibold text-zinc-900">Security</h2>
        </div>

        <form action={changePasswordAction} className="grid max-w-md gap-4">
          <h3 className="text-sm font-medium text-zinc-900">Change password</h3>
          <label className="block text-sm text-zinc-600">
            New password
            <input name="password" type="password" minLength={8} required autoComplete="new-password" className={inputCls} />
          </label>
          <label className="block text-sm text-zinc-600">
            Confirm new password
            <input name="confirm" type="password" minLength={8} required autoComplete="new-password" className={inputCls} />
          </label>
          <div>
            <Button type="submit">Update password</Button>
          </div>
        </form>

        <div className="mt-6 flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-zinc-900">Two-step login (TOTP)</h3>
              <Badge tone="neutral">Coming soon</Badge>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Add an authenticator-app code on top of your password. We’ll enable enrollment here shortly.
            </p>
          </div>
          <Button variant="secondary" disabled>
            Set up
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
