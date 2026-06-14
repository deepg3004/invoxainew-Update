import type { Metadata } from "next";
import { Badge, Button, Container, GlassCard, Section } from "@invoxai/ui";
import { MarketingShell } from "../components/MarketingShell";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "About · InvoxAI",
  description:
    "InvoxAI lets creators and businesses build an AI-powered website, store, and courses, and get paid into their own gateway — we never hold your sales money.",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

const PRINCIPLES: { title: string; body: string }[] = [
  { title: "Your money is yours", body: "Buyers pay into your own gateway. We're a technology provider, not a payment aggregator — your sales never sit with us." },
  { title: "Premium by default", body: "Every site, store and page is built to look modern and trustworthy out of the box, on web and mobile." },
  { title: "Pay for what you use", body: "A small wallet commission and optional paid features — transparent, never hidden, never charged to your buyers." },
  { title: "Built with AI", body: "Describe your business and get a working site in one click — then make it yours in the editor." },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <Section className="pt-20 sm:pt-28">
        <Container className="text-center">
          <Badge tone="brand">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            About InvoxAI
          </Badge>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Commerce tools that <span className="text-gradient">put you in control</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            InvoxAI is an AI-powered website, store, course and payment-page builder for creators,
            coaches, and small businesses. The difference: buyers pay straight into your own payment
            gateway, so you keep control of your money and your customer relationship.
          </p>
        </Container>
      </Section>

      <Section className="py-8">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <GlassCard key={p.title} className="transition hover:border-brand/30">
                <h2 className="font-semibold text-zinc-900">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
              </GlassCard>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="py-14">
        <Container className="text-center">
          <Button href={APP_URL} size="lg">Start free →</Button>
          <p className="mt-4 text-sm text-muted">
            Questions?{" "}
            <a href="/contact" className="underline transition hover:text-zinc-900">Get in touch</a>.
          </p>
        </Container>
      </Section>
    </MarketingShell>
  );
}
