import { describe, it, expect } from "vitest";
import { computeTargetDimensions, PhotoCompressionError } from "./compress";

describe("computeTargetDimensions", () => {
  it("leaves an already-small landscape image unchanged", () => {
    expect(computeTargetDimensions(800, 600, 1280)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("leaves an already-small portrait image unchanged", () => {
    expect(computeTargetDimensions(600, 800, 1280)).toEqual({
      width: 600,
      height: 800,
    });
  });

  it("leaves an image exactly at the max dimension unchanged", () => {
    expect(computeTargetDimensions(1280, 720, 1280)).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("downscales a landscape image to fit the max dimension, preserving aspect ratio", () => {
    // 4000x3000 -> longer edge (width) capped at 1280, ratio 4:3 preserved
    expect(computeTargetDimensions(4000, 3000, 1280)).toEqual({
      width: 1280,
      height: 960,
    });
  });

  it("downscales a portrait image to fit the max dimension, preserving aspect ratio", () => {
    // 3000x4000 -> longer edge (height) capped at 1280, ratio 3:4 preserved
    expect(computeTargetDimensions(3000, 4000, 1280)).toEqual({
      width: 960,
      height: 1280,
    });
  });

  it("downscales a square image to a square at the max dimension", () => {
    expect(computeTargetDimensions(2000, 2000, 1280)).toEqual({
      width: 1280,
      height: 1280,
    });
  });

  it("uses the default max dimension of 1280 when none is given", () => {
    expect(computeTargetDimensions(2560, 1920)).toEqual({
      width: 1280,
      height: 960,
    });
  });

  it("never produces a zero-size dimension for extreme aspect ratios", () => {
    const { width, height } = computeTargetDimensions(10000, 10, 1280);
    expect(width).toBe(1280);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it("throws PhotoCompressionError for non-positive dimensions", () => {
    expect(() => computeTargetDimensions(0, 600, 1280)).toThrow(
      PhotoCompressionError
    );
    expect(() => computeTargetDimensions(600, -1, 1280)).toThrow(
      PhotoCompressionError
    );
  });
});
