import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getTenantTracking,
  getPublishedBioLink,
  listPublishedProducts,
  listPublishedCourses,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../lib/resolve";
import { bioRender, trackHref } from "../../lib/bio";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant || tenant.suspendedAt) return {};
  const bio = await getPublishedBioLink(tenant.id);
  if (!bio) return {};
  const name = bio.displayName ?? tenant.name ?? tenant.username;
  const description = bio.bio?.slice(0, 200) ?? undefined;
  const images = bio.avatarUrl ? [bio.avatarUrl] : undefined;
  return {
    title: name,
    description,
    openGraph: { title: name, description, images, type: "profile" },
  };
}

export default async function BioPage() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const bio = await getPublishedBioLink(tenant.id);
  if (!bio) notFound();

  const [tracking, products, courses] = await Promise.all([
    getTenantTracking(tenant.id),
    listPublishedProducts(tenant.id),
    listPublishedCourses(tenant.id),
  ]);

  const name = bio.displayName ?? tenant.name ?? tenant.username;
  // Shared with the /bio/r redirect's allowlist (single source of truth).
  const { socials, buttons: allLinks } = bioRender(bio, {
    hasProducts: products.length > 0,
    hasCourses: courses.length > 0,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center px-6 py-16 text-center">
      <TrackingScripts ids={tracking ?? {}} />

      {bio.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bio.avatarUrl}
          alt={name}
          className="h-24 w-24 rounded-full border border-zinc-200 object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-gradient text-3xl font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </div>
      )}

      <h1 className="mt-4 font-display text-2xl font-bold">{name}</h1>
      {bio.bio ? <p className="mt-2 whitespace-pre-line text-muted">{bio.bio}</p> : null}

      {socials.length > 0 ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {socials.map((s) => (
            <a
              key={s.label}
              href={trackHref(s.href)}
              target="_blank"
              rel="noreferrer nofollow"
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-muted transition hover:text-zinc-900"
            >
              {s.label}
            </a>
          ))}
        </div>
      ) : null}

      {allLinks.length > 0 ? (
        <div className="mt-8 w-full space-y-3">
          {allLinks.map((l, i) => (
            <a
              key={i}
              href={trackHref(l.href)}
              {...(l.href.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer nofollow" })}
              className="block w-full rounded-2xl border border-zinc-200 bg-white px-5 py-3.5 font-medium backdrop-blur-xl transition hover:border-brand/40 hover:bg-zinc-100"
            >
              {l.label}
            </a>
          ))}
        </div>
      ) : null}

      <footer className="mt-16 text-xs text-muted">
        <a href="/" className="underline">
          {tenant.name ?? tenant.username}
        </a>
      </footer>
    </main>
  );
}
