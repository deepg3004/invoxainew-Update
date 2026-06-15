import { describe, expect, it } from "vitest";
import { seatsRemaining, isSoldOut } from "./workshop";

// Seat math gates workshop checkout (a soft cap). Pin the contract: null cap means
// unlimited (never sold out); a set cap clamps remaining at 0 and flips sold-out.
describe("seatsRemaining", () => {
  it("returns null (unlimited) when there is no cap", () => {
    expect(seatsRemaining(null, 0)).toBeNull();
    expect(seatsRemaining(undefined, 999)).toBeNull();
  });

  it("computes remaining and never goes negative", () => {
    expect(seatsRemaining(50, 0)).toBe(50);
    expect(seatsRemaining(50, 30)).toBe(20);
    expect(seatsRemaining(50, 50)).toBe(0);
    expect(seatsRemaining(50, 60)).toBe(0); // oversold (race) clamps at 0
  });
});

describe("isSoldOut", () => {
  it("unlimited is never sold out", () => {
    expect(isSoldOut(null, 1_000_000)).toBe(false);
  });

  it("a capped workshop is sold out only when full or over", () => {
    expect(isSoldOut(10, 9)).toBe(false);
    expect(isSoldOut(10, 10)).toBe(true);
    expect(isSoldOut(10, 11)).toBe(true);
  });
});
