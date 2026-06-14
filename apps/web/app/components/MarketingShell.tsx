import type { ReactNode } from "react";
import { AuroraBackground, Button, Container } from "@invoxai/ui";
import { getBranding } from "@invoxai/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.invoxai.io";

/**
 * Shared chrome (aurora bg + sticky header + footer) for the marketing site's
 * content pages (features, faq, about). Async server component — pulls the
 * admin-managed logo itself so callers just wrap their content.
 */
export async function MarketingShell({ children }: { children: ReactNode }) {
  const { logoUrl } = await getBranding().catch(() => ({
    logoUrl: undefined as string | undefined,
  }));

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
            <a className="transition hover:text-zinc-900" href="/features">Features</a>
            <a className="transition hover:text-zinc-900" href="/pricing">Pricing</a>
            <a className="transition hover:text-zinc-900" href="/faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button href={APP_URL} variant="ghost" size="sm">Sign in</Button>
            <Button href={APP_URL} size="sm">Start free</Button>
          </div>
        </Container>
      </header>

      {children}

      <footer className="border-t border-zinc-200 py-10">
        <Container className="flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <span className="font-display font-semibold text-zinc-900">
            Invox<span className="text-gradient">AI</span>
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a className="underline transition hover:text-zinc-900" href="/features">Features</a>
            <a className="underline transition hover:text-zinc-900" href="/pricing">Pricing</a>
            <a className="underline transition hover:text-zinc-900" href="/about">About</a>
            <a className="underline transition hover:text-zinc-900" href="/faq">FAQ</a>
            <a className="underline transition hover:text-zinc-900" href="/terms">Terms</a>
            <a className="underline transition hover:text-zinc-900" href="/privacy">Privacy</a>
            <a className="underline transition hover:text-zinc-900" href="/contact">Contact</a>
          </nav>
        </Container>
      </footer>
    </>
  );
}
