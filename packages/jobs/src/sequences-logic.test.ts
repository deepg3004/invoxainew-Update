import { describe, expect, it } from "vitest";
import { planAdvance } from "./sequences-logic";

// planAdvance decides an enrolment's next state after a step is sent: move to the
// next step (scheduling it by its delay) or finish. A wrong pointer/clock here would
// drop steps, repeat them, or schedule at the wrong time. Pure; pinned here.

const now = new Date("2026-06-14T12:00:00Z");
const HOUR = 3_600_000;

describe("planAdvance", () => {
  it("schedules the next step at now + that step's delay", () => {
    // Steps with delays [0, 24, 48]. After sending step 0, step 1 (24h) is due next.
    const plan = planAdvance(0, [0, 24, 48], now);
    expect(plan).toEqual({
      status: "ACTIVE",
      currentStep: 1,
      nextRunAt: new Date(now.getTime() + 24 * HOUR),
    });
  });

  it("advances from a middle step to the last", () => {
    const plan = planAdvance(1, [0, 24, 48], now);
    expect(plan).toEqual({
      status: "ACTIVE",
      currentStep: 2,
      nextRunAt: new Date(now.getTime() + 48 * HOUR),
    });
  });

  it("completes after the final step", () => {
    expect(planAdvance(2, [0, 24, 48], now)).toEqual({ status: "DONE" });
  });

  it("completes a single-step sequence after its one send", () => {
    expect(planAdvance(0, [0], now)).toEqual({ status: "DONE" });
  });

  it("treats a 0-hour next delay as immediately due", () => {
    const plan = planAdvance(0, [0, 0], now);
    expect(plan).toEqual({ status: "ACTIVE", currentStep: 1, nextRunAt: now });
  });

  it("clamps a negative delay to 0 (defensive)", () => {
    const plan = planAdvance(0, [0, -5], now);
    expect(plan).toEqual({ status: "ACTIVE", currentStep: 1, nextRunAt: now });
  });

  it("completes if the pointer is already past the end (steps removed)", () => {
    expect(planAdvance(5, [0, 24], now)).toEqual({ status: "DONE" });
  });
});
