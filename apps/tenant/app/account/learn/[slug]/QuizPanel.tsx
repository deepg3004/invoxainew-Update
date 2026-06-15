"use client";

import { useState } from "react";
import { submitQuizAction, type QuizResult } from "./actions";

export interface LearnerQuizData {
  passPercent: number;
  questions: { id: string; prompt: string; options: string[] }[];
}

export function QuizPanel({
  slug,
  lessonId,
  quiz,
  best,
}: {
  slug: string;
  lessonId: string;
  quiz: LearnerQuizData;
  best: { scorePercent: number; passed: boolean } | null;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = quiz.questions.every((_, i) => answers[i] !== undefined);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const ordered = quiz.questions.map((_, i) => (answers[i] ?? -1));
      const res = await submitQuizAction(slug, lessonId, ordered);
      if (res.ok) setResult(res);
      else setError("Couldn’t submit — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Quiz</h3>
        {best ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              best.passed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            Best: {best.scorePercent}% {best.passed ? "· passed" : ""}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted">Pass mark: {quiz.passPercent}%.</p>

      <div className="mt-4 space-y-4">
        {quiz.questions.map((q, qi) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-zinc-900">
              {qi + 1}. {q.prompt}
            </p>
            <div className="mt-2 space-y-1.5">
              {q.options.map((o, oi) => (
                <label key={oi} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="radio"
                    name={`q-${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() => {
                      setResult(null);
                      setAnswers((a) => ({ ...a, [qi]: oi }));
                    }}
                    className="h-4 w-4"
                  />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {result?.ok ? (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
            result.passed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          You scored {result.scorePercent}% ({result.correct}/{result.total}).{" "}
          {result.passed ? "Passed 🎉" : `You need ${quiz.passPercent}% to pass — try again.`}
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !allAnswered}
        className="mt-4 rounded-lg bg-cyan px-4 py-2 text-sm font-medium text-white hover:bg-cyan/90 disabled:opacity-50"
      >
        {busy ? "Checking…" : result?.ok ? "Submit again" : "Submit answers"}
      </button>
      {!allAnswered ? (
        <span className="ml-3 text-xs text-muted">Answer every question to submit.</span>
      ) : null}
    </div>
  );
}
