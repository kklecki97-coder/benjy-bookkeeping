import { describe, it, expect } from "vitest";
import { parseMonthYear, matchesYear, matchesMonth } from "./folder-match";

describe("parseMonthYear", () => {
  it("parses a valid YYYY-MM", () => {
    expect(parseMonthYear("2026-06")).toEqual({ year: "2026", month: 6 });
  });
  it("rejects bad formats", () => {
    expect(parseMonthYear("2026-13")).toBeNull();
    expect(parseMonthYear("2026/06")).toBeNull();
    expect(parseMonthYear("June")).toBeNull();
    expect(parseMonthYear("2026-6")).toBeNull(); // must be zero-padded
  });
});

describe("matchesYear", () => {
  it("matches the year folder", () => {
    expect(matchesYear("2026", "2026")).toBe(true);
    expect(matchesYear("2026 Statements", "2026")).toBe(true);
  });
  it("does not match a different year", () => {
    expect(matchesYear("2027", "2026")).toBe(false);
  });
});

describe("matchesMonth — June (6) of 2026", () => {
  const ok = (name: string) => expect(matchesMonth(name, 6, "2026")).toBe(true);
  const no = (name: string) => expect(matchesMonth(name, 6, "2026")).toBe(false);

  it("matches month names and abbreviations", () => {
    ok("June");
    ok("june");
    ok("Jun");
    ok(" June ");
  });
  it("matches month name with the correct year", () => {
    ok("June 2026");
  });
  it("matches numeric month forms", () => {
    ok("06");
    ok("6");
    ok("2026-06");
  });
  it("rejects other months", () => {
    no("July");
    no("May");
    no("January");
    no("07");
  });
  it("rejects June of the WRONG year", () => {
    no("June 2027");
    no("2027-06");
  });
  it("does not treat a year number as a month number", () => {
    // "2026" alone is the year folder, not month 6 — bare-number path must skip it
    no("2026");
  });
});

describe("matchesMonth — May vs other words", () => {
  it("matches May (5)", () => {
    expect(matchesMonth("May", 5, "2026")).toBe(true);
    expect(matchesMonth("May 2026", 5, "2026")).toBe(true);
  });
  it("does not false-match 'may' inside another word", () => {
    expect(matchesMonth("Maybe folder", 5, "2026")).toBe(false);
  });
});

describe("matchesMonth — March abbrev edge", () => {
  it("matches 'Mar' and 'March' for month 3", () => {
    expect(matchesMonth("March", 3, "2026")).toBe(true);
    expect(matchesMonth("Mar", 3, "2026")).toBe(true);
  });
});
