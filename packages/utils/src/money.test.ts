import { describe, expect, it } from "vitest";
import {
  paiseToRupeeString,
  formatRupees,
  rupeeStringToPaise,
  bpsToPercentString,
  percentStringToBps,
} from "./money";

describe("paiseToRupeeString / formatRupees", () => {
  it("renders integer paise as a fixed 2-decimal rupee string", () => {
    expect(paiseToRupeeString(14900)).toBe("149.00");
    expect(paiseToRupeeString(0)).toBe("0.00");
    expect(paiseToRupeeString(5)).toBe("0.05");
    expect(paiseToRupeeString(100)).toBe("1.00");
  });

  it("prefixes the rupee symbol", () => {
    expect(formatRupees(14900)).toBe("₹149.00");
    expect(formatRupees(0)).toBe("₹0.00");
  });
});

describe("rupeeStringToPaise", () => {
  it("parses plain and decimal amounts to integer paise", () => {
    expect(rupeeStringToPaise("149")).toEqual({ ok: true, paise: 14900 });
    expect(rupeeStringToPaise("149.5")).toEqual({ ok: true, paise: 14950 });
    expect(rupeeStringToPaise("0")).toEqual({ ok: true, paise: 0 });
  });

  it("strips ₹, commas and whitespace", () => {
    expect(rupeeStringToPaise("₹1,499.00")).toEqual({ ok: true, paise: 149900 });
    expect(rupeeStringToPaise("  10  ")).toEqual({ ok: true, paise: 1000 });
  });

  it("rounds to the nearest paise", () => {
    expect(rupeeStringToPaise("1.999")).toEqual({ ok: true, paise: 200 });
  });

  it("rejects blank input", () => {
    expect(rupeeStringToPaise("")).toMatchObject({ ok: false });
    expect(rupeeStringToPaise("   ")).toMatchObject({ ok: false });
    expect(rupeeStringToPaise("₹")).toMatchObject({ ok: false });
  });

  it("rejects non-numeric input", () => {
    expect(rupeeStringToPaise("abc")).toMatchObject({ ok: false });
    expect(rupeeStringToPaise("12x")).toMatchObject({ ok: false });
  });

  it("rejects negative amounts (no silent 0)", () => {
    expect(rupeeStringToPaise("-5")).toMatchObject({ ok: false });
    expect(rupeeStringToPaise("-0.01")).toMatchObject({ ok: false });
  });
});

describe("bpsToPercentString", () => {
  it("renders basis points as a clean percent string", () => {
    expect(bpsToPercentString(250)).toBe("2.5");
    expect(bpsToPercentString(300)).toBe("3"); // trailing .0 trimmed
    expect(bpsToPercentString(1800)).toBe("18");
    expect(bpsToPercentString(0)).toBe("0");
  });
});

describe("percentStringToBps", () => {
  it("parses plain and decimal percents to integer basis points", () => {
    expect(percentStringToBps("2.5")).toEqual({ ok: true, bps: 250 });
    expect(percentStringToBps("18")).toEqual({ ok: true, bps: 1800 });
  });

  it("strips % and whitespace", () => {
    expect(percentStringToBps("3%")).toEqual({ ok: true, bps: 300 });
    expect(percentStringToBps("  18  ")).toEqual({ ok: true, bps: 1800 });
  });

  it("allows the 0 and 100 boundaries", () => {
    expect(percentStringToBps("0")).toEqual({ ok: true, bps: 0 });
    expect(percentStringToBps("100")).toEqual({ ok: true, bps: 10000 });
  });

  it("rejects blank and non-numeric input", () => {
    expect(percentStringToBps("")).toMatchObject({ ok: false });
    expect(percentStringToBps("abc")).toMatchObject({ ok: false });
  });

  it("rejects out-of-range percents (guards a fat-fingered commission)", () => {
    expect(percentStringToBps("-1")).toMatchObject({ ok: false });
    expect(percentStringToBps("101")).toMatchObject({ ok: false });
    expect(percentStringToBps("1000")).toMatchObject({ ok: false });
  });
});
