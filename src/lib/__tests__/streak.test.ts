import { describe, expect, it } from "vitest";
import { computeStreak, isoDay } from "../streak";

const now = new Date("2026-08-10T12:00:00Z");
const day = (delta: number) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDay(d);
};

describe("computeStreak", () => {
  it("is empty with no activity", () => {
    expect(computeStreak([], now)).toEqual({
      length: 0,
      activeToday: false,
      frozeYesterday: false,
      returning: false,
    });
  });

  it("counts consecutive days including today", () => {
    const streak = computeStreak([day(0), day(-1), day(-2)], now);
    expect(streak.length).toBe(3);
    expect(streak.activeToday).toBe(true);
  });

  it("bridges a single missed day with the free freeze", () => {
    const streak = computeStreak([day(0), day(-2), day(-3)], now);
    expect(streak.length).toBe(3);
    expect(streak.frozeYesterday).toBe(true); // yesterday missed, bridged for free
  });

  it("survives one idle day when yesterday was the gap", () => {
    const streak = computeStreak([day(-2), day(-3)], now);
    expect(streak.length).toBe(2);
    expect(streak.frozeYesterday).toBe(true);
    expect(streak.activeToday).toBe(false);
  });

  it("ends after two or more missed days, flagging the warm welcome", () => {
    const streak = computeStreak([day(-4), day(-5)], now);
    expect(streak.length).toBe(0);
    expect(streak.returning).toBe(true);
  });

  it("does not chain freezes across alternating gaps forever", () => {
    // active, gap, active, gap, gap → the double gap ends it.
    const streak = computeStreak([day(0), day(-2), day(-5)], now);
    expect(streak.length).toBe(2);
  });
});
