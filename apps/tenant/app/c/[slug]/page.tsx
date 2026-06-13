import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSellerGateway,
  getEnabledSellerUpi,
  getTenantTracking,
  getEnrolment,
  getCourseRatingSummary,
  getCourseReviews,
  getBuyerReviewForCourse,
} from "@invoxai/db";
import { formatDateIST } from "@invoxai/utils/date";
import { resolveTenantByHost } from "../../../lib/resolve";
import { cachedCourse } from "../../../lib/content";
import { formatRupees } from "@invoxai/utils/money";
import { CourseBuyBox } from "./CourseBuyBox";
import { MoreFromStore } from "../../MoreFromStore";
import { Stars } from "../../Stars";
import { ReviewForm } from "../../account/orders/[id]/ReviewForm";
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

  const [gateway, upi, tracking, user, rating, reviews] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getSessionUser(),
    getCourseRatingSummary(course.id),
    getCourseReviews(course.id),
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
  // Enrolled learners can review the course (prefilled with their existing review).
  const myReview = enrolment && user ? await getBuyerReviewForCourse(course.id, user.id) : null;

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
      {rating.count > 0 ? (
        <a href="#reviews" className="mt-1 flex items-center gap-2 text-sm">
          <Stars value={rating.avg} />
          <span className="font-medium text-zinc-900">{rating.avg.toFixed(1)}</span>
          <span className="text-muted">
            ({rating.count} review{rating.count === 1 ? "" : "s"})
          </span>
        </a>
      ) : null}
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
          <div>
            <div className="text-center">
              <p className="text-sm font-medium text-green-700">✓ You’re enrolled in this course.</p>
              <Link
                href={`/account/learn/${course.slug}`}
                className="mt-3 inline-block w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white"
              >
                Go to course →
              </Link>
            </div>
            <div className="mt-5 border-t border-zinc-200 pt-5">
              <p className="text-sm font-semibold text-zinc-900">Rate this course</p>
              <div className="mt-3">
                <ReviewForm
                  kind="course"
                  subjectId={course.id}
                  subjectTitle={course.title}
                  initial={
                    myReview
                      ? { rating: myReview.rating, body: myReview.body, authorName: myReview.authorName }
                      : null
                  }
                />
              </div>
            </div>
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

      {reviews.length > 0 ? (
        <section id="reviews" className="mt-8">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Reviews</h2>
            <Stars value={rating.avg} />
            <span className="text-sm text-muted">
              {rating.avg.toFixed(1)} · {rating.count}
            </span>
          </div>
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-zinc-200 bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <Stars value={r.rating} className="text-sm" />
                  <span className="text-xs text-muted">{formatDateIST(r.createdAt)}</span>
                </div>
                {r.body ? (
                  <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{r.body}</p>
                ) : null}
                <p className="mt-1.5 text-xs text-muted">
                  {r.authorName || "Verified learner"} ·{" "}
                  <span className="font-medium text-green-700">✓ Enrolled</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <MoreFromStore tenantId={tenant.id} />
    </main>
  );
}
