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
  getSellerGateway,
  type CourseStatus,
} from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type CourseFormState = { error?: string; saved?: boolean };
export type LessonFormState = { error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

interface ParsedCourse {
  title: string;
  description: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  sortOrder: number;
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
  return {
    ok: true,
    value: {
      title,
      description,
      pricePaise: price.paise,
      compareAtPaise,
      imageUrl: imageRaw || null,
      sortOrder,
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
): { ok: true; value: { title: string; content: string | null; isPreview: boolean; sortOrder: number } } | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Lesson title is required." };
  const content = String(form.get("content") ?? "").trim() || null;
  const isPreview = form.get("isPreview") === "on";
  const orderRaw = String(form.get("sortOrder") ?? "").trim();
  let sortOrder = 0;
  if (orderRaw) {
    const n = Number(orderRaw);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, message: "Order must be a whole number (0 or more)." };
    }
    sortOrder = n;
  }
  return { ok: true, value: { title, content, isPreview, sortOrder } };
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

  await createLesson({ courseId, ...parsed.value });
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

  await updateLesson(courseId, lessonId, parsed.value);
  revalidatePath(`/courses/${courseId}`);
  redirect(`/courses/${courseId}`);
}

export async function deleteLessonAction(courseId: string, lessonId: string) {
  const { tenant } = await requireTenant();
  const course = await getCourseById(tenant.id, courseId);
  if (!course) return;
  await deleteLesson(courseId, lessonId);
  revalidatePath(`/courses/${courseId}`);
}
