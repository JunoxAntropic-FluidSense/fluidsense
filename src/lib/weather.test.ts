import { describe, it, expect } from "vitest";
import { averageTemp, isWarmerThanUsual } from "./weather";

describe("averageTemp", () => {
  it("averages a list of values", () => {
    expect(averageTemp([10, 20, 30])).toBe(20);
  });

  it("returns NaN for an empty list", () => {
    expect(averageTemp([])).toBeNaN();
  });
});

describe("isWarmerThanUsual", () => {
  it("is true when current temp is at least the threshold above the recent average", () => {
    expect(isWarmerThanUsual(28, [20, 21, 22, 23, 24, 25])).toBe(true);
  });

  it("is false when current temp is close to the recent average", () => {
    expect(isWarmerThanUsual(23, [20, 21, 22, 23, 24, 25])).toBe(false);
  });

  it("is false when there is no baseline data", () => {
    expect(isWarmerThanUsual(30, [])).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(isWarmerThanUsual(24, [20, 21, 22, 23, 24, 25], 1)).toBe(true);
  });
});
