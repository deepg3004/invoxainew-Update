import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTenantTracking, getPublishedLeadForm } from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";
import { LeadFormView } from "./LeadFormView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant || tenant.suspendedAt) return {};
  const { slug } = await params;
  const form = await getPublishedLeadForm(tenant.id, slug);
  if (!form) return {};
  const description = form.description?.slice(0, 200) ?? undefined;
  return {
    title: form.title,
    description,
    openGraph: { title: form.title, description, type: "website" },
  };
}

export default async function LeadFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const form = await getPublishedLeadForm(tenant.id, slug);
  if (!form) notFound();

  const tracking = await getTenantTracking(tenant.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        {tenant.name ?? tenant.username}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{form.title}</h1>
      {form.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{form.description}</p>
      ) : null}

      <LeadFormView
        form={{
          id: form.id,
          buttonLabel: form.buttonLabel,
          successMessage: form.successMessage,
          collectPhone: form.collectPhone,
          collectMessage: form.collectMessage,
          redirectUrl: form.redirectUrl,
        }}
      />
    </main>
  );
}
