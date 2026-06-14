import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getPublishedCourseMeta,
  getEnrolment,
  listLessons,
  getBuyerReviewForCourse,
  getCourseProgress,
} from "@invoxai/db";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";
import { ReviewForm } from "../../orders/[id]/ReviewForm";
import { toggleLessonAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  const { slug } = await params;
  const course = await getPublishedCourseMeta(tenant.id, slug);
  if (!course) notFound();

  // ACCESS CONTROL: only an enrolled buyer (by profile or purchase email) may see
  // lesson bodies. Without an enrolment we never load lesson content.
  const enrolment = await getEnrolment({
    tenantId: tenant.id,
    courseId: course.id,
    profileId: user.id,
    email: user.email ?? null,
  });

  if (!enrolment) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          You’re not enrolled in this course yet.
          <Link href={`/c/${course.slug}`} className="ml-1 font-medium underline">
            Get access →
          </Link>
        </div>
      </main>
    );
  }

  const [lessons, myReview, done] = await Promise.all([
    listLessons(course.id),
    // Enrolled buyers can review the course (verified purchase). Prefilled when
    // they've already reviewed it.
    getBuyerReviewForCourse(course.id, user.id),
    getCourseProgress({ tenantId: tenant.id, courseId: course.id, profileId: user.id }),
  ]);
  const completed = lessons.filter((l) => done.has(l.id)).length;
  const pct = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href="/account" className="text-sm text-cyan underline">
          ← Your account
        </Link>
      </div>
      <h1 className="mt-4 text-3xl font-bold">{course.title}</h1>
      {course.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{course.description}</p>
      ) : null}

      {lessons.length > 0 ? (
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Your progress</span>
            <span className="font-medium text-zinc-900">
              {completed} / {lessons.length} lessons
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
        </div>
      ) : null}

      {lessons.length === 0 ? (
        <p className="mt-8 text-muted">The seller hasn’t added any lessons yet.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {lessons.map((l, idx) => {
            const isDone = done.has(l.id);
            return (
              <article key={l.id} className="border-t border-zinc-200 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    <span className="text-muted">{idx + 1}.</span> {l.title}
                    {isDone ? <span className="ml-2 text-sm text-green-600">✓ Completed</span> : null}
                  </h2>
                  <form action={toggleLessonAction.bind(null, slug, l.id)}>
                    <button
                      type="submit"
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        isDone
                          ? "border-zinc-200 text-muted hover:bg-zinc-50"
                          : "border-cyan bg-cyan/10 text-cyan hover:bg-cyan/20"
                      }`}
                    >
                      {isDone ? "Mark incomplete" : "Mark complete"}
                    </button>
                  </form>
                </div>
                {l.content ? (
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-zinc-700">
                    {l.content}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted">No content yet.</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-zinc-200 bg-surface p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Rate this course</h2>
        <p className="mt-1 text-xs text-muted">
          Your review appears on the course page and helps other buyers (verified purchase).
        </p>
        <div className="mt-4">
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
    </main>
  );
}
