import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getCourseById, getLesson, listCourseSections } from "@invoxai/db";
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
  const [lesson, sections] = await Promise.all([
    getLesson(course.id, lessonId),
    listCourseSections(course.id),
  ]);
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
          sections={sections}
          initial={{
            title: lesson.title,
            content: lesson.content,
            videoUrl: lesson.videoUrl,
            durationSec: lesson.durationSec,
            sectionId: lesson.sectionId,
            isPreview: lesson.isPreview,
            sortOrder: lesson.sortOrder,
          }}
        />
      </GlassCard>
    </div>
  );
}
