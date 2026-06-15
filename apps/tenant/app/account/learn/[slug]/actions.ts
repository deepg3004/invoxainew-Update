"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  getPublishedCourseMeta,
  getEnrolment,
  toggleLessonProgress,
  issueCertificateIfEligible,
} from "@invoxai/db";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";

/** Best-effort display name for a certificate: profile full name → email local part. */
function recipientNameFrom(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const meta = user.user_metadata ?? {};
  const full = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (full) return full;
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (name) return name;
  return user.email?.split("@")[0] ?? "Learner";
}

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

  const { completed } = await toggleLessonProgress({
    tenantId: tenant.id,
    courseId: course.id,
    lessonId,
    profileId: user.id,
  });

  // Auto-issue a completion certificate once every lesson is done (best-effort,
  // idempotent, no-op unless the course has certificates enabled + all complete).
  if (completed) {
    await issueCertificateIfEligible({
      tenantId: tenant.id,
      courseId: course.id,
      profileId: user.id,
      recipientName: recipientNameFrom(user),
    }).catch(() => {});
  }

  revalidatePath(`/account/learn/${slug}`);
}
