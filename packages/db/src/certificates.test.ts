import { describe, expect, it } from "vitest";
import { isCourseComplete } from "./certificates";

// A certificate is auto-issued only on full completion. Pin the gate: needs at
// least one lesson AND every lesson done (a 0-lesson course can't be "complete").
describe("isCourseComplete", () => {
  it("is false for a course with no lessons", () => {
    expect(isCourseComplete(0, 0)).toBe(false);
  });

  it("is false until every lesson is done", () => {
    expect(isCourseComplete(5, 0)).toBe(false);
    expect(isCourseComplete(5, 4)).toBe(false);
  });

  it("is true when all lessons are done", () => {
    expect(isCourseComplete(5, 5)).toBe(true);
    expect(isCourseComplete(1, 1)).toBe(true);
  });

  it("stays true if the completed count somehow exceeds the total", () => {
    expect(isCourseComplete(5, 6)).toBe(true); // e.g. a lesson was deleted after completion
  });
});
