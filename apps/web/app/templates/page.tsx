import type { Metadata } from "next";
import { Badge, Button, Container, GlassCard, Section } from "@invoxai/ui";
import { MarketingShell } from "../components/MarketingShell";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Templates · InvoxAI",
  description:
    "Premium AI templates for coaches, course creators, agencies, local businesses, and more — generate a complete site in one click and make it yours.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

const CATEGORIES: { title: string; body: string }[] = [
  { title: "Coach", body: "Book calls, sell programs, capture leads." },
  { title: "Course creator", body: "Sell courses with gated lessons and a learning portal." },
  { title: "Fitness trainer", body: "Plans, memberships, and class bookings." },
  { title: "Trading / finance educator", body: "Webinars, paid communities, and digital guides." },
  { title: "Digital product seller", body: "Instant downloads with secure delivery." },
  { title: "Agency", body: "Showcase services and take project payments." },
  { title: "Local business", body: "Hours, services, and a payment page that converts." },
  { title: "Restaurant / cafe", body: "Menu, orders, and table or pickup bookings." },
  { title: "Doctor / clinic", body: "Appointments, services, and patient enquiries." },
  { title: "Real estate", body: "Listings, enquiries, and booking forms." },
  { title: "Webinar / event", body: "Ticketing, RSVPs, and paid access." },
  { title: "Creator bio", body: "A premium link-in-bio with store and course links." },
  { title: "SaaS landing", body: "Features, pricing, and signups for your product." },
  { title: "E-commerce store", body: "A full store with cart, coupons, and stock." },
  { title: "Community / VIP group", body: "Sell access to a paid Telegram or Discord." },
];

export default function TemplatesPage() {
  return (
    <MarketingShell>
      <Section className="pt-20 sm:pt-28">
        <Container className="text-center">
          <Badge tone="brand">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            One-click AI templates
          </Badge>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            A premium template for <span className="text-gradient">every business</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Pick your business type, describe your goal, and InvoxAI generates a complete,
            on-brand site, store, or funnel — then refine it in the editor. No designer needed.
          </p>
          <div className="mt-9">
            <Button href={APP_URL} size="lg">Start free →</Button>
          </div>
        </Container>
      </Section>

      <Section className="pb-8">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <GlassCard key={c.title} className="transition hover:border-brand/30">
                <h2 className="font-semibold text-zinc-900">{c.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
              </GlassCard>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            Every template is fully editable and mobile-ready, with your brand colours, your
            payment gateway, and built-in ads tracking.
          </p>
        </Container>
      </Section>
    </MarketingShell>
  );
}
