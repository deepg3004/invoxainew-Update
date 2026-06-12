import {
  AuroraBackground,
  Badge,
  Button,
  Container,
  GlassCard,
  Section,
} from "@invoxai/ui";

// Marketing landing — static. The live health probe still lives at /health.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

const FEATURES: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: "AI website builder",
    body: "Describe your business and goal — get a premium, editable landing page, store, or funnel in one click.",
    icon: <Glyph d="M4 5h16M4 12h10M4 19h16" />,
  },
  {
    title: "Store & checkout",
    body: "Sell physical, digital, or service products with a cart, coupons, and stock — checkout on your own gateway.",
    icon: <Glyph d="M3 3h2l2 13h11l2-9H7M9 21h.01M18 21h.01" />,
  },
  {
    title: "Courses",
    body: "Gated lessons, lifetime access, and automatic enrolment the moment a buyer pays.",
    icon: <Glyph d="M12 4 3 9l9 5 9-5-9-5ZM5 11v5l7 4 7-4v-5" />,
  },
  {
    title: "Payment pages",
    body: "Share a clean link, take a payment, send a receipt. Razorpay and UPI, paid straight to you.",
    icon: <Glyph d="M3 7h18v10H3zM3 11h18M7 15h4" />,
  },
  {
    title: "Custom domains",
    body: "Go live on your own domain with automatic SSL — or use your free username.invoxai.io.",
    icon: <Glyph d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />,
  },
  {
    title: "Tracking & analytics",
    body: "Meta Pixel, GA4, Google Ads and UTM-ready on every public page — measure what converts.",
    icon: <Glyph d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-9" />,
  },
];

export default function Home() {
  return (
    <>
      <AuroraBackground />

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-ink/80 backdrop-blur-xl">
        <Container className="flex h-16 items-center justify-between">
          <span className="font-display text-lg font-bold tracking-tight">
            Invox<span className="text-gradient">AI</span>
          </span>
          <nav className="hidden items-center gap-8 text-sm text-muted sm:flex">
            <a className="transition hover:text-zinc-900" href="#how">
              How it works
            </a>
            <a className="transition hover:text-zinc-900" href="#features">
              Features
            </a>
            <a className="transition hover:text-zinc-900" href="#pricing">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button href={APP_URL} variant="ghost" size="sm">
              Sign in
            </Button>
            <Button href={APP_URL} size="sm">
              Start free
            </Button>
          </div>
        </Container>
      </header>

      {/* Hero */}
      <Section className="pt-20 sm:pt-28">
        <Container className="text-center">
          <div className="animate-fade-up">
            <Badge tone="brand">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              AI builder · your gateway · your money
            </Badge>
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            Launch an <span className="text-gradient">AI-built store</span> where
            buyers pay <span className="text-gradient">straight to you</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            InvoxAI builds your website, store, courses and payment pages with AI.
            Buyers pay into your own Razorpay or UPI — we never hold your sales
            money. You only pay a small commission from your wallet.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href={APP_URL} size="lg">
              Start free →
            </Button>
            <Button href="#how" variant="secondary" size="lg">
              See how it works
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted">
            No setup fee · free username.invoxai.io site · upgrade anytime
          </p>
        </Container>
      </Section>

      {/* How the money works — the USP */}
      <Section id="how" className="py-12 sm:py-16">
        <Container>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Buyer pays you directly",
                body: "Checkout runs on your own connected gateway. 100% of the sale lands in your account.",
              },
              {
                step: "02",
                title: "InvoxAI never holds funds",
                body: "We're not in the money flow. No payouts to wait for, no platform float on your sales.",
              },
              {
                step: "03",
                title: "Small wallet commission",
                body: "We auto-deduct a small commission from your prepaid wallet — never from the buyer.",
              },
            ].map((c) => (
              <GlassCard key={c.step} className="transition hover:border-brand/30">
                <span className="font-display text-sm font-semibold text-accent">
                  {c.step}
                </span>
                <h3 className="mt-3 font-display text-lg font-semibold">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
              </GlassCard>
            ))}
          </div>
        </Container>
      </Section>

      {/* Features */}
      <Section id="features">
        <Container>
          <div className="max-w-2xl">
            <Badge tone="cyan">Everything in one place</Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              One platform from idea to paid
            </h2>
            <p className="mt-3 text-muted">
              Build the page, sell the product, take the payment, and track the
              conversion — without stitching five tools together.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <GlassCard key={f.title} className="transition hover:border-brand/30">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-brand/10 text-brand-strong">
                  {f.icon}
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </GlassCard>
            ))}
          </div>
        </Container>
      </Section>

      {/* Pricing teaser / CTA band */}
      <Section id="pricing" className="pb-28">
        <Container>
          <GlassCard className="relative overflow-hidden p-10 text-center sm:p-14">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-brand-gradient opacity-10" />
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Start free. Upgrade when you grow.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">
              Spin up your first AI site and store today on a free
              username.invoxai.io. Add a custom domain, more pages and lower
              commission on a paid plan whenever you're ready.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href={APP_URL} size="lg">
                Create your store →
              </Button>
              <Button href={APP_URL} variant="secondary" size="lg">
                Sign in
              </Button>
            </div>
          </GlassCard>
        </Container>
      </Section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-10">
        <Container className="flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <span className="font-display font-semibold text-zinc-900">
            Invox<span className="text-gradient">AI</span>
          </span>
          <span>
            Buyers pay your gateway. You keep your money. ·{" "}
            <a className="underline transition hover:text-zinc-900" href="/health">
              status
            </a>
          </span>
        </Container>
      </footer>
    </>
  );
}

// Small inline icon — consistent stroke, inherits text color.
function Glyph({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
