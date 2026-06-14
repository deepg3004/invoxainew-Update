import type { Metadata } from "next";
import { Button, Container, GlassCard, Section } from "@invoxai/ui";
import { MarketingShell } from "../components/MarketingShell";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "FAQ · InvoxAI",
  description: "Common questions about InvoxAI — your own gateway, wallet commission, pricing, payouts, and more.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Who receives the money when a buyer pays?",
    a: "You do — directly. Buyers pay into your own connected Razorpay or UPI. InvoxAI is never in the money flow and never holds your sales funds, so there are no payouts to wait for.",
  },
  {
    q: "Then how does InvoxAI make money?",
    a: "A small commission is auto-deducted from your prepaid wallet on each sale (never charged to the buyer), plus optional paid features like extra AI page generations and your subscription plan.",
  },
  {
    q: "What is the wallet for?",
    a: "It's a prepaid balance that covers your platform commission and paid features (e.g. AI page generation beyond your plan's free limit). You top it up via InvoxAI's gateway. If it runs low, you just recharge.",
  },
  {
    q: "Do I need KYC to start?",
    a: "No full KYC to begin — a verified email and your business details are enough. Some cases (custom domain, a verified badge, or higher-risk categories) may require basic verification later.",
  },
  {
    q: "Which payment gateways are supported?",
    a: "Razorpay and manual UPI today, paid straight to you. More providers are on the roadmap. InvoxAI's own gateway is used only for your plan, wallet top-ups, and paid features.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes, on plans that include custom domains — connect your domain with automatic SSL. Every site also gets a free username.invoxai.io address.",
  },
  {
    q: "What can I build and sell?",
    a: "AI-built websites and landing pages, an online store, courses with gated lessons, payment pages, lead forms, a bio link, and paid communities — each with a buyer login portal.",
  },
  {
    q: "Can I track ads and conversions?",
    a: "Yes. Connect Meta Pixel, Google Ads, GA4, and Google Tag Manager. Page views, leads, checkouts, and purchases fire automatically, and you get funnel and campaign analytics.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — start free with a username.invoxai.io site and upgrade anytime. See the pricing page for what each plan includes.",
  },
];

export default function FaqPage() {
  return (
    <MarketingShell>
      <Section className="pt-20 sm:pt-28">
        <Container className="text-center">
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Frequently asked <span className="text-gradient">questions</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            How payments, commission, and the platform work.
          </p>
        </Container>
      </Section>

      <Section className="pb-8">
        <Container className="mx-auto max-w-3xl space-y-3">
          {FAQS.map((f) => (
            <GlassCard key={f.q} className="p-0">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 font-medium text-zinc-900 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            </GlassCard>
          ))}
        </Container>
      </Section>

      <Section className="py-14">
        <Container className="text-center">
          <Button href={APP_URL} size="lg">Start free →</Button>
          <p className="mt-4 text-sm text-muted">
            Still have a question?{" "}
            <a href="/contact" className="underline transition hover:text-zinc-900">Contact us</a>.
          </p>
        </Container>
      </Section>
    </MarketingShell>
  );
}
