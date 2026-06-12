import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getPublishedCourse,
  getSellerGateway,
  getTenantTracking,
  getEnrolment,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { formatRupees } from "@invoxai/utils/money";
import { CourseBuyBox } from "./CourseBuyBox";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";
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
  const course = await getPublishedCourse(tenant.id, slug);
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
  const course = await getPublishedCourse(tenant.id, slug);
  if (!course) notFound();

  const [gateway, tracking, user] = await Promise.all([
    getSellerGateway(tenant.id),
    getTenantTracking(tenant.id),
    getSessionUser(),
  ]);
  const sellerReady = Boolean(gateway && gateway.status === "CONNECTED");

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
      <div className="flex items-center justify-between">
        <Link href="/courses" className="text-sm text-blue-600 underline">
          ← {tenant.name ?? tenant.username} courses
        </Link>
        <CartLink />
      </div>

      {course.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={course.imageUrl}
          alt={course.title}
          className="mt-4 aspect-video w-full rounded-xl border border-neutral-200 object-cover"
        />
      ) : null}

      <h1 className="mt-4 text-2xl font-bold">{course.title}</h1>
      {course.description ? (
        <p className="mt-2 whitespace-pre-line text-neutral-500">{course.description}</p>
      ) : null}

      {/* Curriculum */}
      {course.lessons.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            {course.lessons.length} lesson{course.lessons.length === 1 ? "" : "s"}
          </h2>
          <ul className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {course.lessons.map((l, idx) => (
              <li key={l.id} className="p-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-right text-sm text-neutral-400">{idx + 1}</span>
                  <span className="flex-1 text-sm font-medium text-neutral-800">{l.title}</span>
                  {l.isPreview ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Preview
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">🔒</span>
                  )}
                </div>
                {l.isPreview && l.content ? (
                  <p className="mt-2 whitespace-pre-line pl-7 text-sm text-neutral-500">
                    {l.content}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6">
        {enrolment ? (
          <div className="text-center">
            <p className="text-sm font-medium text-green-700">✓ You’re enrolled in this course.</p>
            <Link
              href={`/account/learn/${course.slug}`}
              className="mt-3 inline-block w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white"
            >
              Go to course →
            </Link>
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold">{formatRupees(course.pricePaise)}</div>
            <p className="mt-1 text-xs text-neutral-400">
              Lifetime access · paid securely to {tenant.name ?? tenant.username} via Razorpay.
            </p>
            {sellerReady ? (
              <CourseBuyBox
                course={{
                  id: course.id,
                  slug: course.slug,
                  title: course.title,
                  pricePaise: course.pricePaise,
                }}
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
