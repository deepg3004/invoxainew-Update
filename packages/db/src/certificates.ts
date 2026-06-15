import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Course-completion certificates. A certificate is auto-issued when a learner
 * finishes EVERY lesson of a certificate-enabled course (issueCertificateIfEligible,
 * called after each lesson toggle). One per (course, buyer) — the unique makes
 * issuance idempotent. NOT a money path. Certs are profile-based (lesson progress
 * requires a logged-in profile, so a certificate always has a buyerProfileId).
 */

/** Pure: has the learner completed the course? (needs ≥1 lesson and all done). */
export function isCourseComplete(totalLessons: number, completedCount: number): boolean {
  return totalLessons > 0 && completedCount >= totalLessons;
}

/** An unguessable public serial for the verify URL. */
function makeSerial(): string {
  return `CERT-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export type IssueResult = { issued: boolean; serial: string | null };

/**
 * Issue a certificate if the learner is eligible: the course has certificates
 * enabled AND they've completed every lesson. Idempotent — returns the existing
 * serial without re-issuing if one already exists. Safe to call after every lesson
 * toggle (cheap when not yet complete). Returns {issued:false,serial:null} when the
 * learner isn't eligible yet.
 */
export async function issueCertificateIfEligible(input: {
  tenantId: string;
  courseId: string;
  profileId: string;
  recipientName: string;
}): Promise<IssueResult> {
  const course = await prisma.course.findFirst({
    where: { id: input.courseId, tenantId: input.tenantId },
    select: { certificateEnabled: true, _count: { select: { lessons: true } } },
  });
  if (!course || !course.certificateEnabled) return { issued: false, serial: null };

  const completed = await prisma.lessonProgress.count({
    where: { courseId: input.courseId, buyerProfileId: input.profileId },
  });
  if (!isCourseComplete(course._count.lessons, completed)) return { issued: false, serial: null };

  const existing = await prisma.certificate.findUnique({
    where: { courseId_buyerProfileId: { courseId: input.courseId, buyerProfileId: input.profileId } },
    select: { serial: true },
  });
  if (existing) return { issued: false, serial: existing.serial };

  const name = input.recipientName.trim().slice(0, 120) || "Learner";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const c = await prisma.certificate.create({
        data: {
          tenantId: input.tenantId,
          courseId: input.courseId,
          buyerProfileId: input.profileId,
          recipientName: name,
          serial: makeSerial(),
        },
        select: { serial: true },
      });
      return { issued: true, serial: c.serial };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // Either the (course,buyer) raced (someone else issued) or a serial clash.
        const ex = await prisma.certificate.findUnique({
          where: { courseId_buyerProfileId: { courseId: input.courseId, buyerProfileId: input.profileId } },
          select: { serial: true },
        });
        if (ex) return { issued: false, serial: ex.serial };
        continue; // serial collision — retry with a fresh one
      }
      throw e;
    }
  }
  return { issued: false, serial: null };
}

/** This buyer's certificates on a tenant, newest first (for the account page). */
export function listBuyerCertificates(input: { tenantId: string; profileId: string }) {
  return prisma.certificate.findMany({
    where: { tenantId: input.tenantId, buyerProfileId: input.profileId },
    orderBy: { issuedAt: "desc" },
    include: { course: { select: { title: true, slug: true } } },
  });
}

/** A certificate by its public serial — for the /verify page. Includes the course
 *  title + issuing store so the page is self-contained and verifiable. */
export function getCertificateBySerial(serial: string) {
  return prisma.certificate.findUnique({
    where: { serial },
    include: {
      course: { select: { title: true } },
      tenant: { select: { name: true, username: true } },
    },
  });
}

/** Count of certificates issued for a course (seller stat). */
export function countCourseCertificates(courseId: string) {
  return prisma.certificate.count({ where: { courseId } });
}
