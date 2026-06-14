import type { Metadata } from "next";
import { AuroraBackground, Badge, Button, Container, GlassCard, Section } from "@invoxai/ui";
import { getBranding, listActivePlans } from "@invoxai/db";
import { bpsToPercentString } from "@invoxai/utils/money";

// Pricing is admin-managed (plans table) — keep it fresh but cache-fast.
export const revalidate = 300;
export const metadata: Metadata = {
  title: "Pricing · InvoxAI",
  description:
    "Simple plans for the InvoxAI AI website, store, course and payment-page builder. Buyers pay you directly; a small commission comes from your wallet.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

/** Whole-rupee marketing price (e.g. 49900 → "₹499"). */
function rupees(paise: number): string {
  return "₹" + new Intl.NumberFormat("en-IN").format(Math.round(paise / 100));
}

function planFeatures(p: {
  commissionBps: number;
  maxProducts: number | null;
  maxAiPages: number | null;
  customDomainAllowed: boolean;
}): string[] {
  return [
    `${bpsToPercentString(p.commissionBps)}% wallet commission on sales`,
    `${p.maxProducts ?? "Unlimited"} products`,
    `${p.maxAiPages ?? "Unlimited"} AI page generations / mo`,
    p.customDomainAllowed ? "Custom domain + automatic SSL" : "Free username.invoxai.io site",
  ];
}

export default async function PricingPage() {
  const [{ logoUrl }, plans] = await Promise.all([
    getBranding().catch(() => ({ logoUrl: undefined as string | undefined })),
    // Graceful empty fallback so a transient DB hiccup at build/render never
    // takes the marketing pricing page down (it renders the "start free" CTA).
    listActivePlans().catch(() => []),
  ]);

  return (
    <>
      <AuroraBackground />

      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-ink/80 backdrop-blur-xl">
        <Container className="flex h-16 items-center justify-between">
          <a href="/" className="flex items-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="InvoxAI" className="h-8 w-auto" />
            ) : (
              <span className="font-display text-lg font-bold tracking-tight">
                Invox<span className="text-gradient">AI</span>
              </span>
            )}
          </a>
          <nav className="hidden items-center gap-8 text-sm text-muted sm:flex">
            <a className="transition hover:text-zinc-900" href="/">Home</a>
            <a className="transition hover:text-zinc-900" href="/pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button href={APP_URL} variant="ghost" size="sm">Sign in</Button>
            <Button href={APP_URL} size="sm">Start free</Button>
          </div>
        </Container>
      </header>

      <Section className="pt-20 sm:pt-28">
        <Container className="text-center">
          <div className="animate-fade-up">
            <Badge tone="brand">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Your gateway · your money
            </Badge>
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Simple, <span className="text-gradient">transparent</span> pricing
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Buyers pay straight into your own Razorpay or UPI — we never hold your sales money.
            You only pay a small commission from your prepaid wallet.
          </p>
        </Container>
      </Section>

      <Section className="pb-8">
        <Container>
          {plans.length === 0 ? (
            <GlassCard className="mx-auto max-w-lg text-center">
              <p className="text-muted">Plans are being finalised. Start free today and upgrade anytime.</p>
              <div className="mt-5">
                <Button href={APP_URL} size="lg">Start free →</Button>
              </div>
            </GlassCard>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => {
                const free = p.priceMonthly === 0;
                return (
                  <GlassCard key={p.id} className="flex flex-col transition hover:border-brand/30">
                    <h2 className="font-display text-xl font-bold text-zinc-900">{p.name}</h2>
                    {p.description ? (
                      <p className="mt-1 text-sm text-muted">{p.description}</p>
                    ) : null}
                    <div className="mt-5 flex items-baseline gap-1">
                      <span className="font-display text-4xl font-bold text-zinc-900">
                        {free ? "Free" : rupees(p.priceMonthly)}
                      </span>
                      {!free ? <span className="text-muted">/mo</span> : null}
                    </div>
                    {!free && p.priceYearly > 0 ? (
                      <p className="mt-1 text-xs text-muted">
                        or {rupees(p.priceYearly)}/yr
                      </p>
                    ) : null}
                    <ul className="mt-6 flex-1 space-y-2 text-sm text-zinc-700">
                      {planFeatures(p).map((f) => (
                        <li key={f} className="flex gap-2">
                          <span className="mt-0.5 text-brand-strong">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-7">
                      <Button href={APP_URL} className="w-full">
                        {free ? "Start free" : `Choose ${p.name}`}
                      </Button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
          <p className="mt-8 text-center text-sm text-muted">
            All plans include the AI builder, store, courses, payment pages, buyer portal and
            ads tracking. Commission is charged from your wallet — never from your buyer.
          </p>
        </Container>
      </Section>

      <footer className="border-t border-zinc-200 py-10">
        <Container className="flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <span className="font-display font-semibold text-zinc-900">
            Invox<span className="text-gradient">AI</span>
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a className="underline transition hover:text-zinc-900" href="/">Home</a>
            <a className="underline transition hover:text-zinc-900" href="/terms">Terms</a>
            <a className="underline transition hover:text-zinc-900" href="/privacy">Privacy</a>
            <a className="underline transition hover:text-zinc-900" href="/refund-policy">Refunds</a>
            <a className="underline transition hover:text-zinc-900" href="/contact">Contact</a>
          </nav>
        </Container>
      </footer>
    </>
  );
}
