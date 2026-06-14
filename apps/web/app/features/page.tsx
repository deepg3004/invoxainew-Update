import type { Metadata } from "next";
import { Badge, Button, Container, GlassCard, Section } from "@invoxai/ui";
import { MarketingShell } from "../components/MarketingShell";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Features · InvoxAI",
  description:
    "Everything in InvoxAI: AI website builder, store, courses, payment pages, buyer portal, your own payment gateway, wallet commission, and ads tracking.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

const GROUPS: { heading: string; items: { title: string; body: string }[] }[] = [
  {
    heading: "Build",
    items: [
      { title: "AI website builder", body: "Describe your business and goal — get a premium, editable landing page, store, or funnel in one click, then refine it in the block editor." },
      { title: "Templates & themes", body: "Start from a ready-made layout and apply your brand colours and accent in seconds." },
      { title: "Bio link", body: "A clean link-in-bio with your store, courses, payment links and socials in one place." },
    ],
  },
  {
    heading: "Sell",
    items: [
      { title: "Store & checkout", body: "Physical, digital, and service products with a cart, coupons, stock, and order bumps — checkout on your own gateway." },
      { title: "Payment pages", body: "Share a clean link, take a payment, send a receipt. Razorpay and manual UPI, paid straight to you." },
      { title: "Courses", body: "Gated lessons with automatic enrolment on payment, a buyer learning portal, and progress tracking." },
      { title: "Communities", body: "Sell access to a paid Telegram, Discord, or private community — access granted the moment a buyer pays." },
    ],
  },
  {
    heading: "Your money",
    items: [
      { title: "Your own gateway", body: "Connect your Razorpay or UPI. Buyers pay you directly — InvoxAI never holds your sales money." },
      { title: "Wallet commission", body: "We auto-deduct a small commission from your prepaid wallet on each sale — never from the buyer." },
      { title: "GST invoices", body: "Tax invoices for your platform fees, with your legal details, generated automatically." },
    ],
  },
  {
    heading: "Grow",
    items: [
      { title: "Ads tracking", body: "Connect Meta Pixel, Google Ads, GA4, and GTM. Purchase, lead, and checkout events fire on every public page." },
      { title: "Analytics", body: "Revenue, traffic, funnel, top products and courses, plus campaign and UTM reports — all in one dashboard." },
      { title: "Lead forms & CRM", body: "Capture leads on any page and build a contact list of your buyers and prospects." },
      { title: "Custom domains", body: "Go live on your own domain with automatic SSL, or use your free username.invoxai.io site." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <Section className="pt-20 sm:pt-28">
        <Container className="text-center">
          <Badge tone="brand">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            One platform, your gateway
          </Badge>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Everything you need to <span className="text-gradient">build and sell</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Website, store, courses, payment pages, buyer portal and ads tracking — built with AI,
            paid into your own gateway.
          </p>
        </Container>
      </Section>

      {GROUPS.map((g) => (
        <Section key={g.heading} className="py-8">
          <Container>
            <h2 className="font-display text-2xl font-bold text-zinc-900">{g.heading}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((it) => (
                <GlassCard key={it.title} className="transition hover:border-brand/30">
                  <h3 className="font-semibold text-zinc-900">{it.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{it.body}</p>
                </GlassCard>
              ))}
            </div>
          </Container>
        </Section>
      ))}

      <Section className="py-14">
        <Container className="text-center">
          <Button href={APP_URL} size="lg">Start free →</Button>
          <p className="mt-4 text-sm text-muted">Free username.invoxai.io site · upgrade anytime</p>
        </Container>
      </Section>
    </MarketingShell>
  );
}
