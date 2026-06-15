import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

// toCsv builds seller-facing data exports (orders, invoices…). It must escape
// per RFC 4180 so a field containing a comma, quote, or newline can't shift
// columns or break rows in the downloaded file. These tests lock the escaping
// contract; a regression here silently corrupts every export.

describe("toCsv", () => {
  it("renders a simple header + rows with no escaping needed", () => {
    expect(
      toCsv(["id", "name"], [
        ["1", "Alice"],
        ["2", "Bob"],
      ]),
    ).toBe("id,name\n1,Alice\n2,Bob");
  });

  it("quotes and doubles embedded double-quotes", () => {
    expect(toCsv(["note"], [['He said "hi"']])).toBe('note\n"He said ""hi"""');
  });

  it("quotes fields containing a comma", () => {
    expect(toCsv(["addr"], [["Kolkata, WB"]])).toBe('addr\n"Kolkata, WB"');
  });

  it("quotes fields containing a newline (row can't break)", () => {
    expect(toCsv(["body"], [["line1\nline2"]])).toBe('body\n"line1\nline2"');
  });

  it("does not quote fields with only safe characters", () => {
    expect(toCsv(["v"], [["plain text 123"]])).toBe("v\nplain text 123");
  });

  it("renders numbers and treats null/undefined as empty cells", () => {
    expect(
      toCsv(["a", "b", "c"], [[1, null, undefined]]),
    ).toBe("a,b,c\n1,,");
  });

  it("escapes a field that contains comma, quote AND newline together", () => {
    expect(toCsv(["x"], [['a,"b"\nc']])).toBe('x\n"a,""b""\nc"');
  });

  it("handles an empty rows array (header only)", () => {
    expect(toCsv(["id", "name"], [])).toBe("id,name");
  });

  it("preserves column count when a middle field is empty", () => {
    expect(toCsv(["a", "b", "c"], [["x", "", "z"]])).toBe("a,b,c\nx,,z");
  });
});
