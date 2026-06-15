import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getCourseById, getLesson, listCourseSections, getQuizForEditing } from "@invoxai/db";
import { requireTenant } from "../../../../../lib/tenant";
import { LessonForm } from "../../../LessonForm";
import { QuizEditor } from "../../../QuizEditor";
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
  const [lesson, sections, quiz] = await Promise.all([
    getLesson(course.id, lessonId),
    listCourseSections(course.id),
    getQuizForEditing(lessonId),
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

      <GlassCard className="mt-6" title="Quiz (optional)">
        <p className="mb-4 text-sm text-muted">
          Add a short multiple-choice quiz learners can take on this lesson as a self-check.
        </p>
        <QuizEditor
          courseId={course.id}
          lessonId={lesson.id}
          initial={
            quiz
              ? {
                  passPercent: quiz.passPercent,
                  questions: quiz.questions.map((q) => ({
                    prompt: q.prompt,
                    options: q.options,
                    correctIndex: q.correctIndex,
                  })),
                }
              : null
          }
        />
      </GlassCard>
    </div>
  );
}
