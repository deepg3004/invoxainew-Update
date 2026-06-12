import { GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { CourseForm } from "../CourseForm";
import { createCourseAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · store"
        title="New course"
        description="Create the course, then add its lessons. Buyers pay you directly on your own gateway and get instant access."
      />
      <GlassCard>
        <CourseForm action={createCourseAction} submitLabel="Create course" />
      </GlassCard>
    </div>
  );
}
