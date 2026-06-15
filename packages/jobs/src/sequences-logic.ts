// Growth G1.3 (Part 2) — pure advance logic for drip sequences. No db/email imports
// so it's trivially unit-testable; the worker (sequences.ts) wires it to data + send.

export type AdvancePlan =
  | { status: "DONE" }
  | { status: "ACTIVE"; currentStep: number; nextRunAt: Date };

/**
 * Given the step just being sent (`currentStep`) and the sequence's per-step delays
 * (hours), compute the enrolment's next state. The pointer moves to the NEXT step;
 * if there is none, the run is DONE. `nextRunAt` is `now + nextStepDelay` hours. Pure.
 */
export function planAdvance(
  currentStep: number,
  delayHours: number[],
  now: Date,
): AdvancePlan {
  const nextIndex = currentStep + 1;
  if (nextIndex >= delayHours.length) return { status: "DONE" };
  const delay = Math.max(0, delayHours[nextIndex] ?? 0);
  return {
    status: "ACTIVE",
    currentStep: nextIndex,
    nextRunAt: new Date(now.getTime() + delay * 3_600_000),
  };
}
