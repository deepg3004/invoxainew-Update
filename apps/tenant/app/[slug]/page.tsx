import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import { getTenantByUsername, getPublishedAiPage } from "@invoxai/db";

export const dynamic = "force-dynamic";

// Shape Claude was constrained to (see app/lib/ai.ts). Rendered as structured
// markup here — never as raw HTML — so a generated page can't inject scripts.
interface LandingPageContent {
  title: string;
  tagline: string;
  sections: { heading: string; body: string }[];
  ctaLabel: string;
}

function isContent(v: unknown): v is LandingPageContent {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.title === "string" &&
    typeof c.tagline === "string" &&
    Array.isArray(c.sections) &&
    typeof c.ctaLabel === "string"
  );
}

export default async function AiLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);
  if (!username) notFound();
  const tenant = await getTenantByUsername(username);
  if (!tenant) notFound();

  const { slug } = await params;
  const page = await getPublishedAiPage(tenant.id, slug);
  if (!page || !isContent(page.content)) notFound();
  const content = page.content;

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          {content.title}
        </h1>
        <p className="mt-4 text-lg text-neutral-500">{content.tagline}</p>
        <div className="mt-8">
          <span className="inline-block cursor-default rounded-lg bg-neutral-900 px-6 py-3 font-medium text-white">
            {content.ctaLabel}
          </span>
        </div>
      </header>

      <div className="mt-16 space-y-10">
        {content.sections.map((s, i) => (
          <section key={i} className="border-t border-neutral-200 pt-8">
            <h2 className="text-xl font-semibold text-neutral-900">{s.heading}</h2>
            <p className="mt-2 leading-relaxed text-neutral-600">{s.body}</p>
          </section>
        ))}
      </div>

      <footer className="mt-20 border-t border-neutral-200 pt-6 text-center text-sm text-neutral-400">
        {tenant.name ?? tenant.username} ·{" "}
        <Link href="/account" className="underline">
          Your orders
        </Link>
      </footer>
    </main>
  );
}
