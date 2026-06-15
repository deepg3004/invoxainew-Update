"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCourse,
  updateCourse,
  setCourseStatus,
  getCourseById,
  createLesson,
  updateLesson,
  deleteLesson,
  createSection,
  renameSection,
  deleteSection,
  getSellerGateway,
  getLesson,
  saveQuiz,
  deleteQuiz,
  type CourseStatus,
  type QuizQuestionInput,
} from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type CourseFormState = { error?: string; saved?: boolean };
export type LessonFormState = { error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

interface ParsedCourse {
  title: string;
  subtitle: string | null;
  description: string | null;
  learnPoints: string[];
  requirements: string[];
  pricePaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  sortOrder: number;
  certificateEnabled: boolean;
}

/** One non-empty line per item, trimmed + capped (for the learn/requirements textareas). */
function parseLines(raw: string, maxItems = 20, maxLen = 200): string[] {
  return String(raw)
    .split("\n")
    .map((s) => s.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseCourseFields(
  form: FormData,
): { ok: true; value: ParsedCourse } | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };

  const price = rupeeStringToPaise(String(form.get("price") ?? ""));
  if (!price.ok) return { ok: false, message: `Price: ${price.message}` };
  if (price.paise <= 0) return { ok: false, message: "Price must be greater than ₹0." };

  const compareRaw = String(form.get("compareAt") ?? "").trim();
  let compareAtPaise: number | null = null;
  if (compareRaw) {
    const cmp = rupeeStringToPaise(compareRaw);
    if (!cmp.ok) return { ok: false, message: `Compare-at price: ${cmp.message}` };
    if (cmp.paise <= price.paise) {
      return { ok: false, message: "Compare-at price must be higher than the price." };
    }
    compareAtPaise = cmp.paise;
  }

  const imageRaw = String(form.get("imageUrl") ?? "").trim();
  if (imageRaw && !/^https?:\/\/\S+$/.test(imageRaw)) {
    return { ok: false, message: "Image URL must start with http:// or https://" };
  }

  const orderRaw = String(form.get("sortOrder") ?? "").trim();
  let sortOrder = 0;
  if (orderRaw) {
    const n = Number(orderRaw);
    if (!Number.isInteger(n)) {
      return { ok: false, message: "Display order must be a whole number." };
    }
    sortOrder = n;
  }

  const description = String(form.get("description") ?? "").trim() || null;
  const subtitle = String(form.get("subtitle") ?? "").trim().slice(0, 200) || null;
  const learnPoints = parseLines(String(form.get("learnPoints") ?? ""));
  const requirements = parseLines(String(form.get("requirements") ?? ""));
  return {
    ok: true,
    value: {
      title,
      subtitle,
      description,
      learnPoints,
      requirements,
      pricePaise: price.paise,
      compareAtPaise,
      imageUrl: imageRaw || null,
      sortOrder,
      certificateEnabled: form.get("certificateEnabled") === "on",
    },
  };
}

export async function createCourseAction(
  _prev: CourseFormState,
  form: FormData,
): Promise<CourseFormState> {
  const { tenant } = await requireTenant();

  // A course is only sellable once buyers can pay — require a connected gateway.
  const gw = await getSellerGateway(tenant.id);
  if (!gw) return { error: "Connect your payment gateway first (Connect gateway)." };

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { error: "Link must be 1–50 chars: lowercase letters, digits, hyphens." };
  }

  const parsed = parseCourseFields(form);
  if (!parsed.ok) return { error: parsed.message };

  const publish = form.get("publish") === "on";
  const result = await createCourse({
    tenantId: tenant.id,
    slug,
    ...parsed.value,
    status: publish ? "PUBLISHED" : "DRAFT",
  });
  if (!result.ok) return { error: `The link "/c/${slug}" is already in use.` };

  revalidatePath("/courses");
  redirect(`/courses/${result.id}`);
}

export async function updateCourseAction(
  id: string,
  _prev: CourseFormState,
  form: FormData,
): Promise<CourseFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseCourseFields(form);
  if (!parsed.ok) return { error: parsed.message };

  await updateCourse(tenant.id, id, parsed.value);
  revalidatePath("/courses");
  revalidatePath(`/courses/${id}`);
  return { saved: true };
}

export async function setCourseStatusAction(id: string, status: CourseStatus) {
  const { tenant } = await requireTenant();
  await setCourseStatus(tenant.id, id, status);
  revalidatePath("/courses");
}

// ── Lessons (ownership verified via the parent course) ───────────────────────

function parseLessonFields(
  form: FormData,
):
  | {
      ok: true;
      value: {
        title: string;
        content: string | null;
        videoUrl: string | null;
        durationSec: number | null;
        sectionId: string | null;
        isPreview: boolean;
        sortOrder: number;
      };
    }
  | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Lesson title is required." };
  const content = String(form.get("content") ?? "").trim() || null;

  const videoRaw = String(form.get("videoUrl") ?? "").trim();
  if (videoRaw && !/^https?:\/\/\S+$/.test(videoRaw)) {
    return { ok: false, message: "Video URL must start with http:// or https://" };
  }

  let durationSec: number | null = null;
  const minsRaw = String(form.get("durationMin") ?? "").trim();
  if (minsRaw) {
    const m = Number(minsRaw);
    if (!Number.isFinite(m) || m < 0) {
      return { ok: false, message: "Duration must be a number of minutes (0 or more)." };
    }
    durationSec = Math.round(m * 60);
  }

  const isPreview = form.get("isPreview") === "on";
  const sectionId = String(form.get("sectionId") ?? "").trim() || null;
  const orderRaw = String(form.get("sortOrder") ?? "").trim();
  let sortOrder = 0;
  if (orderRaw) {
    const n = Number(orderRaw);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, message: "Order must be a whole number (0 or more)." };
    }
    sortOrder = n;
  }
  return {
    ok: true,
    value: { title, content, videoUrl: videoRaw || null, durationSec, sectionId, isPreview, sortOrder },
  };
}

export async function createLessonAction(
  courseId: string,
  _prev: LessonFormState,
  form: FormData,
): Promise<LessonFormState> {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return { error: "Course not found." };

  const parsed = parseLessonFields(form);
  if (!parsed.ok) return { error: parsed.message };

  const lesson = await createLesson({ tenantId: tenant.id, courseId, ...parsed.value });
  if (!lesson) return { error: "Course not found." };
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}

export async function updateLessonAction(
  courseId: string,
  lessonId: string,
  _prev: LessonFormState,
  form: FormData,
): Promise<LessonFormState> {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return { error: "Course not found." };

  const parsed = parseLessonFields(form);
  if (!parsed.ok) return { error: parsed.message };

  await updateLesson(tenant.id, courseId, lessonId, parsed.value);
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}

export async function deleteLessonAction(courseId: string, lessonId: string) {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return;
  await deleteLesson(tenant.id, courseId, lessonId);
  revalidatePath(`/courses/${courseId}`);
}

// ── Sections / modules ───────────────────────────────────────────────────────

export async function createSectionAction(courseId: string, form: FormData) {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return;
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  if (!title) return;
  await createSection(tenant.id, courseId, title);
  revalidatePath(`/courses/${courseId}`);
}

export async function renameSectionAction(courseId: string, sectionId: string, form: FormData) {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return;
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  if (!title) return;
  await renameSection(tenant.id, sectionId, title);
  revalidatePath(`/courses/${courseId}`);
}

export async function deleteSectionAction(courseId: string, sectionId: string) {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return;
  await deleteSection(tenant.id, sectionId);
  revalidatePath(`/courses/${courseId}`);
}

// ── Per-lesson quiz authoring ─────────────────────────────────────────────────

export type QuizSaveResult = { ok: true } | { ok: false; error: string };

/**
 * Create/replace a lesson's quiz. Verifies the course + lesson belong to this
 * tenant (ownership), then validates every question before saving. Called directly
 * from the QuizEditor client with a structured payload.
 */
export async function saveQuizAction(
  courseId: string,
  lessonId: string,
  data: { passPercent: number; questions: QuizQuestionInput[] },
): Promise<QuizSaveResult> {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return { ok: false, error: "Course not found." };
  const lesson = await getLesson(course.id, lessonId);
  if (!lesson) return { ok: false, error: "Lesson not found." };

  const passPercent = Number(data.passPercent);
  if (!Number.isFinite(passPercent) || passPercent < 1 || passPercent > 100) {
    return { ok: false, error: "Pass mark must be between 1 and 100." };
  }
  const questions = Array.isArray(data.questions) ? data.questions : [];
  if (questions.length < 1 || questions.length > 20) {
    return { ok: false, error: "A quiz needs 1–20 questions." };
  }
  const clean: QuizQuestionInput[] = [];
  for (const q of questions) {
    const prompt = String(q.prompt ?? "").trim().slice(0, 500);
    if (!prompt) return { ok: false, error: "Every question needs a prompt." };
    const options = (Array.isArray(q.options) ? q.options : [])
      .map((o) => String(o ?? "").trim().slice(0, 200))
      .filter(Boolean);
    if (options.length < 2 || options.length > 6) {
      return { ok: false, error: `"${prompt.slice(0, 30)}…" needs 2–6 answer options.` };
    }
    const correctIndex = Number(q.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return { ok: false, error: `Pick the correct answer for "${prompt.slice(0, 30)}…".` };
    }
    clean.push({ prompt, options, correctIndex });
  }

  await saveQuiz({ tenantId: tenant.id, lessonId, passPercent: Math.round(passPercent), questions: clean });
  revalidatePath(`/courses/${courseId}/lessons/${lessonId}`);
  return { ok: true };
}

export async function deleteQuizAction(courseId: string, lessonId: string): Promise<void> {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return;
  await deleteQuiz(tenant.id, lessonId);
  revalidatePath(`/courses/${courseId}/lessons/${lessonId}`);
}
