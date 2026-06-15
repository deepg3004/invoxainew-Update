import { notFound } from "next/navigation";
import Link from "next/link";
import { GlassCard, PageHeader, StatCard } from "@invoxai/ui";
import {
  getCourseById,
  listLessons,
  listCourseSections,
  groupLessonsBySection,
  getCourseEnrolmentStats,
  listCourseStudents,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { formatDateIST } from "@invoxai/utils/date";
import { requireTenant } from "../../../lib/tenant";
import { CourseForm } from "../CourseForm";
import { LessonForm } from "../LessonForm";
import {
  updateCourseAction,
  createLessonAction,
  deleteLessonAction,
  createSectionAction,
  renameSectionAction,
  deleteSectionAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const course = await getCourseById(tenant.id, id);
  if (!course) notFound();
  const STUDENT_LIMIT = 50;
  const [lessons, sections, stats, students] = await Promise.all([
    listLessons(course.id),
    listCourseSections(course.id),
    getCourseEnrolmentStats(tenant.id, course.id),
    listCourseStudents(tenant.id, course.id, { take: STUDENT_LIMIT }),
  ]);
  const grouped = groupLessonsBySection(sections, lessons);

  const courseAction = updateCourseAction.bind(null, course.id);
  const addLessonAction = createLessonAction.bind(null, course.id);
  const addSectionAction = createSectionAction.bind(null, course.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · store"
        title="Edit course"
        description={course.title}
      />

      <GlassCard>
        <CourseForm
          action={courseAction}
          submitLabel="Save course"
          initial={{
            slug: course.slug,
            title: course.title,
            subtitle: course.subtitle,
            description: course.description,
            learnPoints: course.learnPoints,
            requirements: course.requirements,
            pricePaise: course.pricePaise,
            compareAtPaise: course.compareAtPaise,
            imageUrl: course.imageUrl,
            sortOrder: course.sortOrder,
            certificateEnabled: course.certificateEnabled,
          }}
        />
      </GlassCard>

      {/* Modules manager */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Modules</h2>
        <p className="mt-1 text-sm text-muted">
          Optional — group lessons into modules. Lessons without a module stay ungrouped.
        </p>
        {sections.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {sections.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-surface p-2">
                <form
                  action={renameSectionAction.bind(null, course.id, s.id)}
                  className="flex flex-1 items-center gap-2"
                >
                  <input
                    name="title"
                    defaultValue={s.title}
                    className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-brand"
                  />
                  <button className="rounded-md px-2 py-1 text-xs text-brand-strong underline">Rename</button>
                </form>
                <form action={deleteSectionAction.bind(null, course.id, s.id)}>
                  <button className="text-xs text-muted underline hover:text-red-700">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addSectionAction} className="mt-3 flex gap-2">
          <input
            name="title"
            placeholder="New module title (e.g. Getting started)"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
          />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Add module</button>
        </form>
      </section>

      {/* Curriculum (grouped by module) */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Curriculum</h2>
        {lessons.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No lessons yet. Add the first below.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {grouped.map((g) => (
              <div key={g.section?.id ?? "ungrouped"}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {g.section?.title ?? "Ungrouped"}
                </h3>
                <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-surface">
                  {g.lessons.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <span className="truncate font-medium text-zinc-900">{l.title}</span>
                        {l.videoUrl ? <span className="ml-2 text-xs text-muted">▶ video</span> : null}
                        {l.isPreview ? (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-brand-strong">
                            Preview
                          </span>
                        ) : null}
                      </div>
                      <Link
                        href={`/courses/${course.id}/lessons/${l.id}`}
                        className="text-sm text-brand-strong underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteLessonAction.bind(null, course.id, l.id)}>
                        <button className="text-sm text-muted underline hover:text-red-700">Delete</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <GlassCard className="mt-5" title="Add a lesson">
          <LessonForm
            action={addLessonAction}
            submitLabel="Add lesson"
            courseId={course.id}
            sections={sections}
          />
        </GlassCard>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Students</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatCard label="Enrolments" value={stats.enrolments} />
          <StatCard label="Revenue" value={formatRupees(stats.revenuePaise)} hint="paid, this course" />
        </div>

        {students.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No students yet. Enrolments appear here once buyers purchase or are granted access.
          </p>
        ) : (
          <GlassCard className="mt-4 overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Enrolled</th>
                  <th className="px-4 py-3 font-medium text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        {s.name ? (
                          <span className="font-medium text-zinc-900">{s.name}</span>
                        ) : null}
                        <span className={s.name ? "ml-2 text-muted" : "text-zinc-900"}>
                          {s.email ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateIST(s.enrolledAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.free ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-muted">Free</span>
                      ) : (
                        formatRupees(s.amountPaise)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        )}
        {stats.enrolments > students.length ? (
          <p className="mt-2 text-xs text-muted">
            Showing the latest {students.length} of {stats.enrolments} students.
          </p>
        ) : null}
      </section>
    </div>
  );
}
