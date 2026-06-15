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
  getCourseEnrolmentStats,
  listCourseSections,
  groupLessonsBySection,
} from "@invoxai/db";
import { formatDateIST } from "@invoxai/utils/date";
import { toEmbedUrl } from "@invoxai/utils/blocks";
import { resolveTenantByHost } from "../../../lib/resolve";
import { cachedCourse } from "../../../lib/content";
import { formatRupees } from "@invoxai/utils/money";

/** Short duration label, e.g. 750 → "13m". */
function durLabel(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.round(sec / 60);
  return m >= 1 ? `${m}m` : `${sec}s`;
}
import { CourseBuyBox } from "./CourseBuyBox";
import { MoreFromStore } from "../../MoreFromStore";
import { Stars } from "../../Stars";
import { ReviewForm } from "../../account/orders/[id]/ReviewForm";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";
import { TrackView } from "../../TrackView";
import { CartLink } from "../../CartLink";
import { StickyBuyBar } from "../../StickyBuyBar";
import { ThemeStyle, AnimatedBg, BuiltWithBadge } from "../../ThemeRuntime";
import { resolveTheme, normalizeTheme } from "@invoxai/utils/blocks";
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

  const [gateway, upi, tracking, user, rating, reviews, stats, sections] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getSessionUser(),
    getCourseRatingSummary(course.id),
    getCourseReviews(course.id),
    getCourseEnrolmentStats(tenant.id, course.id),
    listCourseSections(course.id),
  ]);
  const previewCount = course.lessons.filter((l) => l.isPreview).length;
  const grouped = groupLessonsBySection(sections, course.lessons);
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
  const theme = resolveTheme(normalizeTheme({ theme: { preset: tenant.storeTheme || "pure-snow" } }));

  return (
    <div className="iv-page" style={{ background: theme.bg, minHeight: "100vh", position: "relative" }}>
    <ThemeStyle t={theme} />
    <AnimatedBg type={theme.background} />
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-10">
      <TrackingScripts ids={tracking ?? {}} />
      <TrackView name={course.title} valuePaise={course.pricePaise} />
      <div className="flex items-center justify-between">
        <Link href="/courses" className="text-sm text-cyan underline">
          ← {tenant.name ?? tenant.username} courses
        </Link>
        <CartLink />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold leading-tight">{course.title}</h1>
          {course.subtitle ? (
            <p className="mt-2 text-lg text-zinc-700">{course.subtitle}</p>
          ) : null}
          {course.description ? (
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{course.description}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {rating.count > 0 ? (
              <a href="#reviews" className="flex items-center gap-1.5">
                <span className="font-semibold text-zinc-900">{rating.avg.toFixed(1)}</span>
                <Stars value={rating.avg} className="text-sm" />
                <span className="text-muted">({rating.count})</span>
              </a>
            ) : null}
            {stats.enrolments > 0 ? (
              <span className="text-muted">
                {stats.enrolments} student{stats.enrolments === 1 ? "" : "s"}
              </span>
            ) : null}
            <span className="text-muted">
              {course.lessons.length} lesson{course.lessons.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            Created by{" "}
            <span className="font-medium text-zinc-900">{tenant.name ?? tenant.username}</span>
          </p>

          {/* What you'll learn */}
          {course.learnPoints.length > 0 ? (
            <section className="mt-8 rounded-xl border border-zinc-200 bg-surface p-5">
              <h2 className="text-lg font-semibold text-zinc-900">What you'll learn</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {course.learnPoints.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-700">
                    <span className="mt-0.5 shrink-0 text-green-600">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Curriculum */}
          {course.lessons.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">Course content</h2>
              <p className="mt-1 text-sm text-muted">
                {course.lessons.length} lesson{course.lessons.length === 1 ? "" : "s"}
                {previewCount > 0
                  ? ` · ${previewCount} free preview${previewCount === 1 ? "" : "s"}`
                  : ""}
              </p>
              <div className="mt-3 space-y-4">
                {grouped.map((g) => {
                  let n = 0;
                  return (
                    <div key={g.section?.id ?? "ungrouped"}>
                      {g.section ? (
                        <h3 className="mb-2 text-sm font-semibold text-zinc-900">{g.section.title}</h3>
                      ) : sections.length > 0 ? (
                        <h3 className="mb-2 text-sm font-semibold text-zinc-900">More lessons</h3>
                      ) : null}
                      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-surface">
                        {g.lessons.map((l) => {
                          n += 1;
                          return (
                            <li key={l.id} className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="w-5 text-right text-sm text-muted">{n}</span>
                                <span className="flex-1 text-sm font-medium text-zinc-900">{l.title}</span>
                                {l.videoUrl ? <span className="text-xs text-muted">▶</span> : null}
                                {durLabel(l.durationSec) ? (
                                  <span className="text-xs text-muted">{durLabel(l.durationSec)}</span>
                                ) : null}
                                {l.isPreview ? (
                                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-cyan">
                                    Preview
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted">🔒</span>
                                )}
                              </div>
                              {/* Free preview: embed the video (if any), else show the preview text. */}
                              {l.isPreview && l.videoUrl && toEmbedUrl(l.videoUrl) ? (
                                <div className="mt-2 ml-7 aspect-video overflow-hidden rounded-lg border border-zinc-200 bg-black">
                                  <iframe
                                    src={toEmbedUrl(l.videoUrl)}
                                    className="h-full w-full"
                                    title={l.title}
                                    allowFullScreen
                                  />
                                </div>
                              ) : l.isPreview && l.content ? (
                                <p className="mt-2 whitespace-pre-line pl-7 text-sm text-muted">{l.content}</p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Requirements */}
          {course.requirements.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">Requirements</h2>
              <ul className="mt-3 space-y-1.5">
                {course.requirements.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-700">
                    <span className="mt-0.5 shrink-0 text-muted">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Enrolled — leave a review */}
          {enrolment ? (
            <section className="mt-8 rounded-xl border border-zinc-200 bg-surface p-5">
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
            </section>
          ) : null}

          {/* Reviews */}
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
        </div>

        {/* ── Sticky purchase card (Udemy-style) ──────────────────────── */}
        <aside className="lg:col-span-1">
          <div id="buybox" className="overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-card lg:sticky lg:top-6">
            {course.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.imageUrl} alt={course.title} className="aspect-video w-full object-cover" />
            ) : null}
            <div className="p-5">
              {enrolment ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-green-700">✓ You’re enrolled</p>
                  <Link
                    href={`/account/learn/${course.slug}`}
                    className="mt-3 inline-block w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white"
                  >
                    Go to course →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-bold">{formatRupees(course.pricePaise)}</span>
                    {course.compareAtPaise != null && course.compareAtPaise > course.pricePaise ? (
                      <>
                        <span className="text-lg text-muted line-through">
                          {formatRupees(course.compareAtPaise)}
                        </span>
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700">
                          {Math.round((1 - course.pricePaise / course.compareAtPaise) * 100)}% off
                        </span>
                      </>
                    ) : null}
                  </div>
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
                  <ul className="mt-5 space-y-1.5 border-t border-zinc-200 pt-4 text-sm text-muted">
                    <li>✓ {course.lessons.length} on-demand lesson{course.lessons.length === 1 ? "" : "s"}</li>
                    <li>✓ Lifetime access</li>
                    <li>✓ Learn at your own pace</li>
                    <li>✓ Paid securely to {tenant.name ?? tenant.username}</li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <MoreFromStore tenantId={tenant.id} />

      {sellerReady && !enrolment ? (
        <StickyBuyBar label="Enroll now" offerPaise={course.pricePaise} compareAtPaise={course.compareAtPaise} />
      ) : null}
    </main>
    <BuiltWithBadge />
    </div>
  );
}
