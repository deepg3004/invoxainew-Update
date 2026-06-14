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
  subtitle?: string | null;
  description?: string | null;
  learnPoints?: string[];
  requirements?: string[];
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
        subtitle: input.subtitle ?? null,
        description: input.description ?? null,
        learnPoints: input.learnPoints ?? [],
        requirements: input.requirements ?? [],
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
export function listCourses(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.course.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { lessons: true, enrolments: true } } },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countCourses(tenantId: string) {
  return prisma.course.count({ where: { tenantId } });
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
    subtitle?: string | null;
    description?: string | null;
    learnPoints?: string[];
    requirements?: string[];
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
      subtitle: data.subtitle ?? null,
      description: data.description ?? null,
      learnPoints: data.learnPoints ?? [],
      requirements: data.requirements ?? [],
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
  tenantId: string,
  courseId: string,
  lessonId: string,
  data: { title: string; content?: string | null; isPreview: boolean; sortOrder: number },
) {
  // `course: { tenantId }` makes the db layer self-enforce ownership (F3) rather
  // than relying solely on the action's getCourseById precheck.
  return prisma.lesson.updateMany({
    where: { id: lessonId, courseId, course: { tenantId } },
    data: {
      title: data.title,
      content: data.content ?? null,
      isPreview: data.isPreview,
      sortOrder: data.sortOrder,
    },
  });
}

export function deleteLesson(tenantId: string, courseId: string, lessonId: string) {
  return prisma.lesson.deleteMany({
    where: { id: lessonId, courseId, course: { tenantId } },
  });
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

// ── Seller-side course analytics / roster ────────────────────────────────────

export type CourseStudent = {
  id: string;
  name: string | null;
  email: string | null;
  amountPaise: number;
  free: boolean;
  enrolledAt: Date;
};

/**
 * Per-course headline stats for the seller: total enrolments and PAID revenue
 * attributed to this course. Revenue comes from BuyerPayment (the authoritative
 * money record), not the enrolment rows (which include free grants). Tenant-scoped.
 */
export async function getCourseEnrolmentStats(
  tenantId: string,
  courseId: string,
): Promise<{ enrolments: number; revenuePaise: number }> {
  const [enrolments, revenue] = await Promise.all([
    prisma.enrolment.count({ where: { tenantId, courseId } }),
    prisma.buyerPayment.aggregate({
      where: { tenantId, courseId, status: "PAID" },
      _sum: { amountPaise: true },
    }),
  ]);
  return { enrolments, revenuePaise: revenue._sum.amountPaise ?? 0 };
}

/**
 * The students enrolled in a course (newest first), with the buyer's name/email
 * and what they paid. Names are resolved from Profile when the buyer was signed
 * in at checkout; otherwise we fall back to the purchase email. A null
 * `buyerPaymentId` means a free/granted enrolment. Tenant-scoped.
 */
export async function listCourseStudents(
  tenantId: string,
  courseId: string,
  opts: { skip?: number; take?: number } = {},
): Promise<CourseStudent[]> {
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
  const skip = Math.max(opts.skip ?? 0, 0);

  const rows = await prisma.enrolment.findMany({
    where: { tenantId, courseId },
    orderBy: { createdAt: "desc" },
    take,
    skip,
    include: { buyerPayment: { select: { amountPaise: true, buyerEmail: true } } },
  });

  const profileIds = [
    ...new Set(rows.map((r) => r.buyerProfileId).filter((x): x is string => Boolean(x))),
  ];
  const profiles = profileIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, fullName: true, email: true },
      })
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((r) => {
    const p = r.buyerProfileId ? byId.get(r.buyerProfileId) : undefined;
    return {
      id: r.id,
      name: p?.fullName ?? null,
      email: p?.email ?? r.buyerEmail ?? r.buyerPayment?.buyerEmail ?? null,
      amountPaise: r.buyerPayment?.amountPaise ?? 0,
      free: !r.buyerPaymentId,
      enrolledAt: r.createdAt,
    };
  });
}

/**
 * Course-analytics breakout: every course with its enrolment count and PAID
 * revenue (courses are bought as single courseId orders, so the grouped sum is
 * exact), sorted by revenue. Tenant-scoped.
 */
export async function getCourseAnalytics(tenantId: string): Promise<{
  courses: { id: string; title: string; enrolments: number; revenuePaise: number }[];
  totalEnrolments: number;
  totalRevenuePaise: number;
}> {
  const [courses, revenue] = await Promise.all([
    prisma.course.findMany({
      where: { tenantId },
      select: { id: true, title: true, _count: { select: { enrolments: true } } },
    }),
    prisma.buyerPayment.groupBy({
      by: ["courseId"],
      where: { tenantId, status: "PAID", courseId: { not: null } },
      _sum: { amountPaise: true },
    }),
  ]);
  const revByCourse = new Map(revenue.map((r) => [r.courseId, r._sum.amountPaise ?? 0]));
  const rows = courses
    .map((c) => ({
      id: c.id,
      title: c.title,
      enrolments: c._count.enrolments,
      revenuePaise: revByCourse.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.revenuePaise - a.revenuePaise || b.enrolments - a.enrolments);
  return {
    courses: rows,
    totalEnrolments: rows.reduce((s, c) => s + c.enrolments, 0),
    totalRevenuePaise: rows.reduce((s, c) => s + c.revenuePaise, 0),
  };
}

// ── Lesson progress (buyer course tracking) ──────────────────────────────────

/**
 * Toggle a buyer's completion of one lesson. Presence of a LessonProgress row =
 * completed. Idempotent/race-safe (unique on [lessonId, buyerProfileId]). The
 * CALLER must verify the buyer is enrolled before calling. Returns the new state.
 */
export async function toggleLessonProgress(input: {
  tenantId: string;
  courseId: string;
  lessonId: string;
  profileId: string;
}): Promise<{ completed: boolean }> {
  const existing = await prisma.lessonProgress.findUnique({
    where: { lessonId_buyerProfileId: { lessonId: input.lessonId, buyerProfileId: input.profileId } },
    select: { id: true },
  });
  if (existing) {
    await prisma.lessonProgress.delete({ where: { id: existing.id } });
    return { completed: false };
  }
  try {
    await prisma.lessonProgress.create({
      data: {
        tenantId: input.tenantId,
        courseId: input.courseId,
        lessonId: input.lessonId,
        buyerProfileId: input.profileId,
      },
    });
  } catch (e) {
    // Lost a concurrent toggle race on the unique key — it's already complete.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { completed: true };
    }
    throw e;
  }
  return { completed: true };
}

/** The set of lessonIds this buyer has completed in a course (for the player UI). */
export async function getCourseProgress(input: {
  tenantId: string;
  courseId: string;
  profileId: string;
}): Promise<Set<string>> {
  const rows = await prisma.lessonProgress.findMany({
    where: { tenantId: input.tenantId, courseId: input.courseId, buyerProfileId: input.profileId },
    select: { lessonId: true },
  });
  return new Set(rows.map((r) => r.lessonId));
}
