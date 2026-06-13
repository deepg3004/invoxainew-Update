import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSellerGateway,
  getEnabledSellerUpi,
  getTenantTracking,
  getEnrolment,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { cachedCourse } from "../../../lib/content";
import { formatRupees } from "@invoxai/utils/money";
import { CourseBuyBox } from "./CourseBuyBox";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";
import { TrackView } from "../../TrackView";
import { CartLink } from "../../CartLink";
import { getSessionUser } from "../../../lib/auth";

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
  const course = await cachedCourse(tenant.id, slug);
  if (!course) return {};
  const description = course.description?.slice(0, 200) ?? undefined;
  const images = course.imageUrl ? [course.imageUrl] : undefined;
  return {
    title: course.title,
    description,
    openGraph: { title: course.title, description, images, type: "website" },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: course.title,
      description,
      images,
    },
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const course = await cachedCourse(tenant.id, slug);
  if (!course) notFound();

  const [gateway, upi, tracking, user] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getSessionUser(),
  ]);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const sellerReady = razorpayReady || Boolean(upi);

  // If the signed-in buyer already owns this course, send them to the lessons.
  const enrolment = user
    ? await getEnrolment({
        tenantId: tenant.id,
        courseId: course.id,
        profileId: user.id,
        email: user.email ?? null,
      })
    : null;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <TrackView name={course.title} valuePaise={course.pricePaise} />
      <div className="flex items-center justify-between">
        <Link href="/courses" className="text-sm text-cyan underline">
          ← {tenant.name ?? tenant.username} courses
        </Link>
        <CartLink />
      </div>

      {course.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={course.imageUrl}
          alt={course.title}
          className="mt-4 aspect-video w-full rounded-xl border border-zinc-200 object-cover"
        />
      ) : null}

      <h1 className="mt-4 text-2xl font-bold">{course.title}</h1>
      {course.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{course.description}</p>
      ) : null}

      {/* Curriculum */}
      {course.lessons.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {course.lessons.length} lesson{course.lessons.length === 1 ? "" : "s"}
          </h2>
          <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-surface">
            {course.lessons.map((l, idx) => (
              <li key={l.id} className="p-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-right text-sm text-muted">{idx + 1}</span>
                  <span className="flex-1 text-sm font-medium text-zinc-900">{l.title}</span>
                  {l.isPreview ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-cyan">
                      Preview
                    </span>
                  ) : (
                    <span className="text-xs text-muted">🔒</span>
                  )}
                </div>
                {l.isPreview && l.content ? (
                  <p className="mt-2 whitespace-pre-line pl-7 text-sm text-muted">
                    {l.content}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-6">
        {enrolment ? (
          <div className="text-center">
            <p className="text-sm font-medium text-green-700">✓ You’re enrolled in this course.</p>
            <Link
              href={`/account/learn/${course.slug}`}
              className="mt-3 inline-block w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white"
            >
              Go to course →
            </Link>
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold">{formatRupees(course.pricePaise)}</div>
            <p className="mt-1 text-xs text-muted">
              Lifetime access · paid securely to {tenant.name ?? tenant.username}.
            </p>
            {sellerReady ? (
              <CourseBuyBox
                course={{
                  id: course.id,
                  slug: course.slug,
                  title: course.title,
                  pricePaise: course.pricePaise,
                }}
                razorpayReady={razorpayReady}
                upi={
                  upi
                    ? { upiId: upi.upiId, payeeName: upi.displayName ?? tenant.name ?? tenant.username }
                    : null
                }
              />
            ) : (
              <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                This seller hasn’t finished setting up payments yet.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
