"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPublishedCourseMeta, getEnrolment, toggleLessonProgress } from "@invoxai/db";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";

/**
 * Toggle the logged-in buyer's completion of a lesson. Re-verifies tenant (by
 * host), session, and enrolment server-side before writing — the page's gate is
 * not trusted. No-op on any failure (the UI just won't change).
 */
export async function toggleLessonAction(slug: string, lessonId: string): Promise<void> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return;

  const user = await getSessionUser();
  if (!user) return;

  const course = await getPublishedCourseMeta(tenant.id, slug);
  if (!course) return;

  const enrolment = await getEnrolment({
    tenantId: tenant.id,
    courseId: course.id,
    profileId: user.id,
    email: user.email ?? null,
  });
  if (!enrolment) return;

  await toggleLessonProgress({
    tenantId: tenant.id,
    courseId: course.id,
    lessonId,
    profileId: user.id,
  });
  revalidatePath(`/account/learn/${slug}`);
}
