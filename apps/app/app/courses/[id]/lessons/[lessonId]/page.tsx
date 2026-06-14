import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
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
      <PageHeader
        eyebrow="InvoxAI · store"
        title="Edit lesson"
        description={course.title}
      />
      <GlassCard>
        <LessonForm
          action={action}
          submitLabel="Save lesson"
          courseId={course.id}
          initial={{
            title: lesson.title,
            content: lesson.content,
            videoUrl: lesson.videoUrl,
            durationSec: lesson.durationSec,
            isPreview: lesson.isPreview,
            sortOrder: lesson.sortOrder,
          }}
        />
      </GlassCard>
    </div>
  );
}
