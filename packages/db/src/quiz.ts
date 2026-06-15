import { prisma } from "./client";

/**
 * Per-lesson quizzes (self-check MCQs). Authoring (seller) replaces the whole
 * question set in one transaction. The LEARNER read NEVER includes correctIndex —
 * grading happens server-side in gradeAndRecordAttempt. NOT a money path. Ownership
 * is enforced by the caller (the seller action verifies the lesson's course belongs
 * to the tenant before writing); tenantId is stamped for scoped reads.
 */

/** Pure: grade answers against the correct indexes. answers[i] is the chosen option
 *  index for question i (or undefined/-1 if unanswered). */
export function gradeQuiz(
  correctIndexes: number[],
  answers: number[],
  passPercent: number,
): { correct: number; total: number; scorePercent: number; passed: boolean } {
  const total = correctIndexes.length;
  let correct = 0;
  for (let i = 0; i < total; i++) {
    if (answers[i] === correctIndexes[i]) correct++;
  }
  const scorePercent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, scorePercent, passed: total > 0 && scorePercent >= passPercent };
}

export interface QuizQuestionInput {
  prompt: string;
  options: string[];
  correctIndex: number;
}

/**
 * Create/replace a lesson's quiz with the given questions (seller). The caller MUST
 * have verified the lesson belongs to the tenant. Replaces the question set wholesale
 * inside a transaction so a save is atomic. passPercent is clamped to 1–100.
 */
export async function saveQuiz(input: {
  tenantId: string;
  lessonId: string;
  passPercent: number;
  questions: QuizQuestionInput[];
}): Promise<{ id: string }> {
  const passPercent = Math.max(1, Math.min(100, Math.round(input.passPercent)));
  return prisma.$transaction(async (tx) => {
    const quiz = await tx.quiz.upsert({
      where: { lessonId: input.lessonId },
      create: { tenantId: input.tenantId, lessonId: input.lessonId, passPercent },
      update: { passPercent },
      select: { id: true },
    });
    await tx.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
    if (input.questions.length > 0) {
      await tx.quizQuestion.createMany({
        data: input.questions.map((q, i) => ({
          quizId: quiz.id,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          sortOrder: i,
        })),
      });
    }
    return quiz;
  });
}

/** Delete a lesson's quiz (seller). Caller verifies ownership; tenant-scoped. */
export async function deleteQuiz(tenantId: string, lessonId: string): Promise<boolean> {
  const res = await prisma.quiz.deleteMany({ where: { lessonId, tenantId } });
  return res.count === 1;
}

/** The full quiz for the SELLER editor (includes correctIndex). */
export function getQuizForEditing(lessonId: string) {
  return prisma.quiz.findUnique({
    where: { lessonId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
}

export type LearnerQuiz = {
  id: string;
  passPercent: number;
  questions: { id: string; prompt: string; options: string[] }[];
};

/** The quiz for a LEARNER — correctIndex is stripped so answers never reach the
 *  browser. Returns null when the lesson has no quiz. */
export async function getQuizForLearner(lessonId: string): Promise<LearnerQuiz | null> {
  const quiz = await prisma.quiz.findUnique({
    where: { lessonId },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, prompt: true, options: true },
      },
    },
  });
  if (!quiz || quiz.questions.length === 0) return null;
  return { id: quiz.id, passPercent: quiz.passPercent, questions: quiz.questions };
}

/**
 * Grade a learner's submission server-side and record the attempt. Loads the
 * correct indexes (never trusting the client), grades with gradeQuiz, and stores a
 * QuizAttempt. Returns the result for the UI. Returns null if the quiz is gone.
 */
export async function gradeAndRecordAttempt(input: {
  tenantId: string;
  lessonId: string;
  profileId: string;
  answers: number[];
}): Promise<{ correct: number; total: number; scorePercent: number; passed: boolean } | null> {
  const quiz = await prisma.quiz.findUnique({
    where: { lessonId: input.lessonId },
    include: { questions: { orderBy: { sortOrder: "asc" }, select: { correctIndex: true } } },
  });
  if (!quiz || quiz.questions.length === 0) return null;

  const result = gradeQuiz(
    quiz.questions.map((q) => q.correctIndex),
    input.answers,
    quiz.passPercent,
  );
  await prisma.quizAttempt.create({
    data: {
      tenantId: input.tenantId,
      quizId: quiz.id,
      buyerProfileId: input.profileId,
      scorePercent: result.scorePercent,
      passed: result.passed,
    },
  });
  return result;
}

/** A learner's best attempt at a lesson's quiz (for the "passed" badge), or null. */
export async function getBestQuizAttempt(lessonId: string, profileId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { lessonId }, select: { id: true } });
  if (!quiz) return null;
  return prisma.quizAttempt.findFirst({
    where: { quizId: quiz.id, buyerProfileId: profileId },
    orderBy: { scorePercent: "desc" },
    select: { scorePercent: true, passed: true },
  });
}
