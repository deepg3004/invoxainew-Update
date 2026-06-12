import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getPublishedCourseMeta,
  getEnrolment,
  listLessons,
} from "@invoxai/db";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";

export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  const { slug } = await params;
  const course = await getPublishedCourseMeta(tenant.id, slug);
  if (!course) notFound();

  // ACCESS CONTROL: only an enrolled buyer (by profile or purchase email) may see
  // lesson bodies. Without an enrolment we never load lesson content.
  const enrolment = await getEnrolment({
    tenantId: tenant.id,
    courseId: course.id,
    profileId: user.id,
    email: user.email ?? null,
  });

  if (!enrolment) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          You’re not enrolled in this course yet.
          <Link href={`/c/${course.slug}`} className="ml-1 font-medium underline">
            Get access →
          </Link>
        </div>
      </main>
    );
  }

  const lessons = await listLessons(course.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href="/account" className="text-sm text-cyan underline">
          ← Your account
        </Link>
      </div>
      <h1 className="mt-4 text-3xl font-bold">{course.title}</h1>
      {course.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{course.description}</p>
      ) : null}

      {lessons.length === 0 ? (
        <p className="mt-8 text-muted">The seller hasn’t added any lessons yet.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {lessons.map((l, idx) => (
            <article key={l.id} className="border-t border-white/10 pt-6">
              <h2 className="text-lg font-semibold">
                <span className="text-muted">{idx + 1}.</span> {l.title}
              </h2>
              {l.content ? (
                <p className="mt-3 whitespace-pre-line leading-relaxed text-neutral-200">
                  {l.content}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted">No content yet.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
