import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourseById, listLessons } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { CourseForm } from "../CourseForm";
import { LessonForm } from "../LessonForm";
import {
  updateCourseAction,
  createLessonAction,
  deleteLessonAction,
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
  const lessons = await listLessons(course.id);

  const courseAction = updateCourseAction.bind(null, course.id);
  const addLessonAction = createLessonAction.bind(null, course.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Edit course</h1>
      <p className="mt-1 text-muted">{course.title}</p>

      <section className="mt-6">
        <CourseForm
          action={courseAction}
          submitLabel="Save course"
          initial={{
            slug: course.slug,
            title: course.title,
            description: course.description,
            pricePaise: course.pricePaise,
            imageUrl: course.imageUrl,
            sortOrder: course.sortOrder,
          }}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Curriculum</h2>
        {lessons.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No lessons yet. Add the first below.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-surface">
            {lessons.map((l, idx) => (
              <li key={l.id} className="flex items-center gap-3 p-3">
                <span className="w-6 text-right text-sm text-muted">{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <span className="truncate font-medium text-white">{l.title}</span>
                  {l.isPreview ? (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-cyan">
                      Preview
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/courses/${course.id}/lessons/${l.id}`}
                  className="text-sm text-cyan underline"
                >
                  Edit
                </Link>
                <form action={deleteLessonAction.bind(null, course.id, l.id)}>
                  <button className="text-sm text-muted underline hover:text-red-700">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 rounded-xl border border-dashed border-white/10 p-4">
          <h3 className="text-sm font-semibold text-neutral-200">Add a lesson</h3>
          <div className="mt-3">
            <LessonForm
              action={addLessonAction}
              submitLabel="Add lesson"
              courseId={course.id}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
