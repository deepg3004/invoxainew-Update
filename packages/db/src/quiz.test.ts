import { describe, expect, it } from "vitest";
import { gradeQuiz } from "./quiz";

// gradeQuiz is the SERVER-SIDE grader (the client never sees correct answers). Pin
// the contract: score is correct/total rounded to a percent; passed needs ≥1
// question and score ≥ passPercent; a wrong/missing answer (-1) counts as incorrect.
describe("gradeQuiz", () => {
  it("scores all-correct as 100% and passes", () => {
    expect(gradeQuiz([0, 1, 2], [0, 1, 2], 70)).toEqual({
      correct: 3,
      total: 3,
      scorePercent: 100,
      passed: true,
    });
  });

  it("scores partial and rounds the percentage", () => {
    // 2/3 = 66.67 → 67
    expect(gradeQuiz([0, 0, 0], [0, 0, 1], 70)).toEqual({
      correct: 2,
      total: 3,
      scorePercent: 67,
      passed: false,
    });
  });

  it("passes exactly at the pass mark", () => {
    expect(gradeQuiz([0, 1], [0, 1], 100).passed).toBe(true);
    expect(gradeQuiz([0, 1, 1, 1], [0, 1, 1, 0], 75)).toMatchObject({ scorePercent: 75, passed: true });
  });

  it("treats unanswered (-1) and out-of-range as wrong", () => {
    expect(gradeQuiz([0, 1, 2], [-1, 1, 9], 50)).toMatchObject({ correct: 1, scorePercent: 33, passed: false });
  });

  it("an empty quiz is never passed", () => {
    expect(gradeQuiz([], [], 1)).toEqual({ correct: 0, total: 0, scorePercent: 0, passed: false });
  });
});
