// Downscales and re-encodes a photo before it's uploaded or handed to any
// downstream processing. Mobile camera photos routinely land at several MB;
// nothing in the app needs more than ~1280px on the long edge, so we shrink
// via <canvas> and re-encode as JPEG to keep uploads fast and cheap. No
// image-processing library is used — canvas is native to every supported
// browser.
//
// The dimension math is split out as a pure function (computeTargetDimensions)
// so it can be unit-tested directly: this repo's Vitest setup runs in the
// default Node environment, with no jsdom/canvas available, so the actual
// canvas-rendering path below cannot be exercised in tests.

const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_QUALITY = 0.8;

export class PhotoCompressionError extends Error {}

/**
 * Given an image's natural width/height, returns the largest size with the
 * same aspect ratio whose longer edge is at most `maxDim`. Images already
 * within bounds are returned unchanged (no upscaling).
 */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxDim: number = DEFAULT_MAX_DIMENSION
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new PhotoCompressionError("Image dimensions must be positive.");
  }
  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }
  const scale = width >= height ? maxDim / width : maxDim / height;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Downscales an image file/blob to at most `maxDim` pixels on its longer
 * edge (preserving aspect ratio) and re-encodes it as JPEG at `quality`.
 * Resolves with the original blob's dimensions unchanged if it's already
 * within bounds, still re-encoded as JPEG.
 */
export async function compressImage(
  file: File | Blob,
  maxDim: number = DEFAULT_MAX_DIMENSION,
  quality: number = DEFAULT_QUALITY
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoCompressionError("Could not read the image data.");
  }

  const { width, height } = computeTargetDimensions(
    bitmap.width,
    bitmap.height,
    maxDim
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new PhotoCompressionError("Canvas rendering is not available.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  if (!blob) {
    throw new PhotoCompressionError("Could not encode the compressed image.");
  }
  return blob;
}
