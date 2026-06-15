"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { saveQuizAction, deleteQuizAction } from "./actions";

interface QuestionDraft {
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface QuizInitial {
  passPercent: number;
  questions: QuestionDraft[];
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

function emptyQuestion(): QuestionDraft {
  return { prompt: "", options: ["", ""], correctIndex: 0 };
}

export function QuizEditor({
  courseId,
  lessonId,
  initial,
}: {
  courseId: string;
  lessonId: string;
  initial: QuizInitial | null;
}) {
  const [passPercent, setPassPercent] = useState(initial?.passPercent ?? 70);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initial?.questions.length ? initial.questions : [emptyQuestion()],
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function patch(i: number, p: Partial<QuestionDraft>) {
    setStatus("idle");
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...p } : q)));
  }
  function setOption(qi: number, oi: number, value: string) {
    setStatus("idle");
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q,
      ),
    );
  }
  function addOption(qi: number) {
    setQuestions((qs) =>
      qs.map((q, idx) => (idx === qi && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q)),
    );
  }
  function removeOption(qi: number, oi: number) {
    setQuestions((qs) =>
      qs.map((q, idx) => {
        if (idx !== qi || q.options.length <= 2) return q;
        const options = q.options.filter((_, j) => j !== oi);
        const correctIndex = q.correctIndex >= options.length ? options.length - 1 : q.correctIndex;
        return { ...q, options, correctIndex };
      }),
    );
  }

  async function save() {
    setStatus("saving");
    setError(null);
    const res = await saveQuizAction(courseId, lessonId, { passPercent, questions });
    if (res.ok) setStatus("saved");
    else {
      setError(res.error);
      setStatus("idle");
    }
  }

  async function remove() {
    if (!confirm("Remove this quiz?")) return;
    await deleteQuizAction(courseId, lessonId);
    setQuestions([emptyQuestion()]);
    setPassPercent(70);
    setStatus("idle");
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium text-zinc-700">Pass mark</span>
        <input
          type="number"
          min={1}
          max={100}
          value={passPercent}
          onChange={(e) => {
            setStatus("idle");
            setPassPercent(Number(e.target.value));
          }}
          className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-900 outline-none focus:border-brand"
        />
        <span className="text-muted">%</span>
      </label>

      {questions.map((q, qi) => (
        <div key={qi} className="space-y-2 rounded-lg border border-zinc-200 p-3">
          <div className="flex items-start gap-2">
            <input
              value={q.prompt}
              onChange={(e) => patch(qi, { prompt: e.target.value })}
              placeholder={`Question ${qi + 1}`}
              className={inputCls}
            />
            {questions.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setQuestions((qs) => qs.filter((_, i) => i !== qi));
                }}
                className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-700"
                aria-label="Remove question"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted">Tick the correct answer.</p>
          {q.options.map((o, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={q.correctIndex === oi}
                onChange={() => patch(qi, { correctIndex: oi })}
                className="h-4 w-4"
                aria-label={`Mark option ${oi + 1} correct`}
              />
              <input
                value={o}
                onChange={(e) => setOption(qi, oi, e.target.value)}
                placeholder={`Option ${oi + 1}`}
                className={inputCls}
              />
              {q.options.length > 2 ? (
                <button
                  type="button"
                  onClick={() => removeOption(qi, oi)}
                  className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
                  aria-label="Remove option"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          ))}
          {q.options.length < 6 ? (
            <button
              type="button"
              onClick={() => addOption(qi)}
              className="text-xs font-medium text-brand-strong hover:underline"
            >
              + Add option
            </button>
          ) : null}
        </div>
      ))}

      {questions.length < 20 ? (
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setQuestions((qs) => [...qs, emptyQuestion()]);
          }}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
        >
          + Add question
        </button>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save quiz"}
        </button>
        {initial ? (
          <button type="button" onClick={remove} className="text-sm text-red-600 underline">
            Remove quiz
          </button>
        ) : null}
      </div>
    </div>
  );
}
