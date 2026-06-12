import { requireTenant } from "../../../lib/tenant";
import { CourseForm } from "../CourseForm";
import { createCourseAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">New course</h1>
      <p className="mt-1 text-muted">
        Create the course, then add its lessons. Buyers pay you directly on your
        own gateway and get instant access.
      </p>
      <div className="mt-6">
        <CourseForm action={createCourseAction} submitLabel="Create course" />
      </div>
    </div>
  );
}
