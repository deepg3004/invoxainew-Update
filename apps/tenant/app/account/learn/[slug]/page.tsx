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
import { toEmbedUrl } from "@invoxai/utils/blocks";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";
import { ReviewForm } from "../../orders/[id]/ReviewForm";
import { toggleLessonAction } from "./actions";

export const dynamic = "force-dynamic";

/** Short duration label, e.g. 750 → "13m". */
function durLabel(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.round(sec / 60);
  return m >= 1 ? `${m}m` : `${sec}s`;
}

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  const { slug } = await params;
  const { lesson: lessonParam } = await searchParams;
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

  // Active lesson: the one in ?lesson= (if valid), else the first incomplete, else the first.
  const activeId =
    lessonParam && lessons.some((l) => l.id === lessonParam)
      ? lessonParam
      : (lessons.find((l) => !done.has(l.id))?.id ?? lessons[0]?.id);
  const activeIdx = lessons.findIndex((l) => l.id === activeId);
  const active = activeIdx >= 0 ? lessons[activeIdx] : null;
  const next = active && activeIdx < lessons.length - 1 ? lessons[activeIdx + 1] : null;

  const reviewBlock = (
    <div className="rounded-xl border border-zinc-200 bg-surface p-5">
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
  );

  if (lessons.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/account" className="text-sm text-cyan underline">← Your account</Link>
        <h1 className="mt-4 text-3xl font-bold">{course.title}</h1>
        <p className="mt-8 text-muted">The seller hasn’t added any lessons yet.</p>
        <div className="mt-10">{reviewBlock}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/account" className="text-sm text-cyan underline">← Your account</Link>
      <h1 className="mt-3 text-2xl font-bold">{course.title}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── Curriculum sidebar ──────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-zinc-200 bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-zinc-900">Course content</span>
              <span className="text-muted">{pct}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{completed} / {lessons.length} lessons done</p>
          </div>
          <ul className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-surface">
            {lessons.map((l, idx) => {
              const isDone = done.has(l.id);
              const isActive = l.id === activeId;
              return (
                <li key={l.id} className="border-t border-zinc-100 first:border-t-0">
                  <Link
                    href={`?lesson=${l.id}`}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2.5 text-sm ${
                      isActive ? "bg-cyan/10" : "hover:bg-zinc-50"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${
                        isDone ? "bg-green-600 text-white" : "border border-zinc-300 text-muted"
                      }`}
                    >
                      {isDone ? "✓" : idx + 1}
                    </span>
                    <span className={`flex-1 ${isActive ? "font-medium text-zinc-900" : "text-zinc-700"}`}>
                      {l.title}
                    </span>
                    {l.videoUrl ? <span className="shrink-0 text-xs text-muted">▶</span> : null}
                    {durLabel(l.durationSec) ? (
                      <span className="shrink-0 text-xs text-muted">{durLabel(l.durationSec)}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* ── Lesson content pane ─────────────────────────────────────── */}
        <section className="min-w-0">
          {active ? (
            <article className="rounded-xl border border-zinc-200 bg-surface p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Lesson {activeIdx + 1} of {lessons.length}
              </p>
              <h2 className="mt-1 text-xl font-bold text-zinc-900">{active.title}</h2>
              {active.videoUrl && toEmbedUrl(active.videoUrl) ? (
                <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border border-zinc-200 bg-black">
                  <iframe
                    src={toEmbedUrl(active.videoUrl)}
                    className="h-full w-full"
                    title={active.title}
                    allowFullScreen
                  />
                </div>
              ) : null}
              {active.content ? (
                <p className="mt-4 whitespace-pre-line leading-relaxed text-zinc-700">
                  {active.content}
                </p>
              ) : !active.videoUrl ? (
                <p className="mt-4 text-sm text-muted">No content for this lesson yet.</p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5">
                <form action={toggleLessonAction.bind(null, slug, active.id)}>
                  <button
                    type="submit"
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      done.has(active.id)
                        ? "border-zinc-200 text-muted hover:bg-zinc-50"
                        : "border-cyan bg-cyan text-white hover:bg-cyan/90"
                    }`}
                  >
                    {done.has(active.id) ? "✓ Completed — mark incomplete" : "Mark complete"}
                  </button>
                </form>
                {next ? (
                  <Link
                    href={`?lesson=${next.id}`}
                    scroll={false}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Next lesson →
                  </Link>
                ) : (
                  <span className="text-sm text-muted">Last lesson 🎉</span>
                )}
              </div>
            </article>
          ) : null}

          <div className="mt-6">{reviewBlock}</div>
        </section>
      </div>
    </main>
  );
}
