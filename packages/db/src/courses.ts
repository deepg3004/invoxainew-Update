import { Prisma, type CourseStatus } from "@prisma/client";
import { prisma } from "./client";

/**
 * Courses / LMS (Final Plan §10, slice 1).
 *
 * MONEY MODEL (hard rule): a course is sold on the SELLER's own gateway like a
 * product — money settles seller-direct, commission comes from the seller's
 * wallet (see markBuyerPaymentPaid). The PAID order grants an Enrolment; this
 * file is the catalog/curriculum + enrolment reads. Enrolment WRITES happen only
 * inside the PAID claim in payments.ts (claim-winner only), never here.
 *
 * ACCESS CONTROL: lesson bodies are private. The public course page only ever
 * receives PREVIEW lesson content (getPublishedCourse strips the rest); full
 * content is read via listLessons only after an enrolment check (the learn page).
 * Every read/write is tenant-scoped; lesson ops are scoped through their course.
 */

// ── Courses (seller-managed) ──────────────────────────────────────────────────

export type CreateCourseResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

export async function createCourse(input: {
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  pricePaise: number;
  compareAtPaise?: number | null;
  imageUrl?: string | null;
  sortOrder?: number;
  status?: CourseStatus;
}): Promise<CreateCourseResult> {
  try {
    const course = await prisma.course.create({
      data: {
        tenantId: input.tenantId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        pricePaise: input.pricePaise,
        compareAtPaise: input.compareAtPaise ?? null,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder ?? 0,
        status: input.status ?? "DRAFT",
      },
      select: { id: true },
    });
    return { ok: true, id: course.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "slug_taken" };
    }
    throw e;
  }
}

/** A seller's courses, newest first, with a lesson count. Scoped by tenantId. */
export function listCourses(tenantId: string) {
  return prisma.course.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { lessons: true, enrolments: true } } },
  });
}

/** A course owned by this tenant (seller scope). */
export function getCourseById(tenantId: string, id: string) {
  return prisma.course.findFirst({ where: { id, tenantId } });
}

export function updateCourse(
  tenantId: string,
  id: string,
  data: {
    title: string;
    description?: string | null;
    pricePaise: number;
    compareAtPaise?: number | null;
    imageUrl?: string | null;
    sortOrder?: number;
  },
) {
  return prisma.course.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description ?? null,
      pricePaise: data.pricePaise,
      compareAtPaise: data.compareAtPaise ?? null,
      imageUrl: data.imageUrl ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export function setCourseStatus(tenantId: string, id: string, status: CourseStatus) {
  return prisma.course.updateMany({ where: { id, tenantId }, data: { status } });
}

// ── Lessons (scoped through their course) ────────────────────────────────────

/** Lessons of a course, in curriculum order. Caller must own the course. */
export function listLessons(courseId: string) {
  return prisma.lesson.findMany({
    where: { courseId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** A lesson by id, scoped to its course (the caller has verified course ownership). */
export function getLesson(courseId: string, lessonId: string) {
  return prisma.lesson.findFirst({ where: { id: lessonId, courseId } });
}

export function createLesson(input: {
  courseId: string;
  title: string;
  content?: string | null;
  isPreview?: boolean;
  sortOrder?: number;
}) {
  return prisma.lesson.create({
    data: {
      courseId: input.courseId,
      title: input.title,
      content: input.content ?? null,
      isPreview: input.isPreview ?? false,
      sortOrder: input.sortOrder ?? 0,
    },
    select: { id: true },
  });
}

export function updateLesson(
  courseId: string,
  lessonId: string,
  data: { title: string; content?: string | null; isPreview: boolean; sortOrder: number },
) {
  return prisma.lesson.updateMany({
    where: { id: lessonId, courseId },
    data: {
      title: data.title,
      content: data.content ?? null,
      isPreview: data.isPreview,
      sortOrder: data.sortOrder,
    },
  });
}

export function deleteLesson(courseId: string, lessonId: string) {
  return prisma.lesson.deleteMany({ where: { id: lessonId, courseId } });
}

// ── Public storefront reads ───────────────────────────────────────────────────

/** The PUBLISHED course catalog for a tenant — the public courses listing. */
export function listPublishedCourses(tenantId: string) {
  return prisma.course.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { lessons: true } } },
  });
}

/**
 * A PUBLISHED course by tenant+slug for the public course page, with its
 * curriculum. SECURITY: non-preview lesson bodies are stripped to null here so
 * they never reach the public page's HTML — only PREVIEW content is public.
 */
export async function getPublishedCourse(tenantId: string, slug: string) {
  const course = await prisma.course.findFirst({
    where: { tenantId, slug, status: "PUBLISHED" },
    include: {
      lessons: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, isPreview: true, sortOrder: true, content: true },
      },
    },
  });
  if (!course) return null;
  return {
    ...course,
    lessons: course.lessons.map((l) => (l.isPreview ? l : { ...l, content: null })),
  };
}

/** A PUBLISHED course by id — used by the buyer checkout action so price/title
 *  are read server-trusted from the DB, never from the client. */
export function getPublishedCourseById(id: string) {
  return prisma.course.findFirst({ where: { id, status: "PUBLISHED" } });
}

/** A PUBLISHED course's meta WITHOUT lessons — for the learn page, which loads
 *  full lesson content separately via listLessons after the enrolment check.
 *  Using getPublishedCourse there would fetch (and preview-strip) the lessons a
 *  second time for nothing. */
export function getPublishedCourseMeta(tenantId: string, slug: string) {
  return prisma.course.findFirst({
    where: { tenantId, slug, status: "PUBLISHED" },
  });
}

// ── Enrolments (access grants; reads only — writes live in payments.ts) ────────

/**
 * This buyer's enrolment in a course, or null. Attributed by profileId (logged
 * in at checkout) OR by a matching purchase email (guest), so a guest purchase
 * unlocks access once the buyer signs in with the same email. Tenant-scoped.
 */
export function getEnrolment(input: {
  tenantId: string;
  courseId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: Prisma.EnrolmentWhereInput[] = [
    { buyerProfileId: input.profileId },
  ];
  if (input.email) attribution.push({ buyerEmail: input.email });
  return prisma.enrolment.findFirst({
    where: { tenantId: input.tenantId, courseId: input.courseId, OR: attribution },
  });
}

/** The published courses this buyer is enrolled in on this tenant (deduped). */
export async function listEnrolledCourses(input: {
  tenantId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: Prisma.EnrolmentWhereInput[] = [
    { buyerProfileId: input.profileId },
  ];
  if (input.email) attribution.push({ buyerEmail: input.email });
  const enrolments = await prisma.enrolment.findMany({
    where: { tenantId: input.tenantId, OR: attribution },
    orderBy: { createdAt: "desc" },
    distinct: ["courseId"],
    include: {
      course: {
        select: { id: true, slug: true, title: true, imageUrl: true, status: true },
      },
    },
  });
  // Only surface courses that are still published/active.
  return enrolments
    .map((e) => e.course)
    .filter((c) => c.status !== "ARCHIVED");
}
