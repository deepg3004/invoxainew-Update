import { notFound } from "next/navigation";
import { getCourseById, getLesson } from "@invoxai/db";
import { requireTenant } from "../../../../../lib/tenant";
import { LessonForm } from "../../../LessonForm";
import { updateLessonAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id, lessonId } = await params;
  const course = await getCourseById(tenant.id, id);
  if (!course) notFound();
  const lesson = await getLesson(course.id, lessonId);
  if (!lesson) notFound();

  const action = updateLessonAction.bind(null, course.id, lesson.id);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Edit lesson</h1>
      <p className="mt-1 text-muted">{course.title}</p>
      <div className="mt-6">
        <LessonForm
          action={action}
          submitLabel="Save lesson"
          courseId={course.id}
          initial={{
            title: lesson.title,
            content: lesson.content,
            isPreview: lesson.isPreview,
            sortOrder: lesson.sortOrder,
          }}
        />
      </div>
    </div>
  );
}
