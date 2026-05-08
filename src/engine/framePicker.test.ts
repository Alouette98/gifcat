import { describe, it, expect } from "vitest";
import { pickFrameIndex } from "./framePicker";

describe("pickFrameIndex", () => {
  it("returns 0 for empty delays", () => {
    expect(pickFrameIndex([], 100)).toBe(0);
  });

  it("returns 0 for negative cursor", () => {
    expect(pickFrameIndex([100, 200], -50)).toBe(0);
  });

  it("returns 0 for single frame", () => {
    expect(pickFrameIndex([500], 0)).toBe(0);
    expect(pickFrameIndex([500], 250)).toBe(0);
    expect(pickFrameIndex([500], 499)).toBe(0);
  });

  it("selects correct frame across variable delays", () => {
    const delays = [100, 200, 300];
    expect(pickFrameIndex(delays, 0)).toBe(0);
    expect(pickFrameIndex(delays, 50)).toBe(0);
    expect(pickFrameIndex(delays, 99)).toBe(0);
    expect(pickFrameIndex(delays, 100)).toBe(1);
    expect(pickFrameIndex(delays, 200)).toBe(1);
    expect(pickFrameIndex(delays, 299)).toBe(1);
    expect(pickFrameIndex(delays, 300)).toBe(2);
    expect(pickFrameIndex(delays, 599)).toBe(2);
  });

  it("wraps cursor at total duration", () => {
    const delays = [100, 200, 300];
    const total = 600;
    expect(pickFrameIndex(delays, total)).toBe(0);
    expect(pickFrameIndex(delays, total + 50)).toBe(0);
    expect(pickFrameIndex(delays, total + 100)).toBe(1);
    expect(pickFrameIndex(delays, total * 2)).toBe(0);
  });

  it("returns 0 when all delays are zero", () => {
    expect(pickFrameIndex([0, 0, 0], 100)).toBe(0);
  });

  it("handles cursor exactly at frame boundary", () => {
    const delays = [100, 100, 100];
    expect(pickFrameIndex(delays, 100)).toBe(1);
    expect(pickFrameIndex(delays, 200)).toBe(2);
  });
});
