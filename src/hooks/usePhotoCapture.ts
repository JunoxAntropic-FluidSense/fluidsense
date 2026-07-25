// Orchestrates capture -> compress -> (estimate | upload) as a single
// stateful flow, reusable across the Add and Voice pages wherever a drink
// photo can be attached to a FluidEvent. Mirrors useVoiceCapture.ts's shape:
// a status-machine union, refs for mutable resources plus a statusRef mirror
// kept in sync via useEffect (so async continuations never act on a stale
// status), and a cancelledRef guard around in-flight async work set by
// cancel()/reset(). Unlike useVoiceCapture, this hook also owns an
// object-URL preview of the captured photo — created on every capture(),
// revoked both on unmount and whenever a fresh capture/reset replaces it,
// so repeated capture cycles never leak blob URLs.
//
// Never auto-persists anything, per CLAUDE.md's "voice entries never save
// without explicit confirmation" rule applied the same way to photos:
// capture() only prepares a local preview, requestEstimate() only calls the
// (optional) estimate-volume function and returns the suggestion, and
// attach() only uploads the compressed blob to Storage and hands back its
// path — writing that path onto a FluidEvent, and committing the event
// itself, stays the caller's job via src/store/useStore.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImage, PhotoCompressionError } from "../lib/photo/compress";
import { uploadDrinkPhoto, type UploadPhotoResult } from "../lib/photo/storage";
import {
  estimateVolume,
  type EstimateVolumeResult,
} from "../lib/photo/estimateVolume";
import { isSupabaseConfigured } from "../lib/supabase/client";

// Mirrors SERVER_STT_CONFIGURED (src/lib/voice/transcribe.ts): computed once
// at module scope from the shared isSupabaseConfigured() check, rather than
// duplicating the env-var check locally (see issue #0011's Context) or
// branching inside the hook on every render.
const ESTIMATE_AVAILABLE = isSupabaseConfigured();

export type PhotoCaptureStatus =
  "idle" | "capturing" | "processing" | "ready" | "error";

export function usePhotoCapture() {
  const [status, setStatus] = useState<PhotoCaptureStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateVolumeResult | null>(null);

  const blobRef = useRef<File | Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const statusRef = useRef<PhotoCaptureStatus>("idle");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const revokePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  useEffect(
    () => () => {
      cancelledRef.current = true;
      revokePreview();
    },
    []
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMessage(null);
    setEstimate(null);
    setPreviewUrl(null);
    revokePreview();
    blobRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    reset();
  }, [reset]);

  /**
   * Takes a captured/selected image (e.g. from an <input type="file">
   * change event) and prepares a local object-URL preview. Validates the
   * image is decodable before committing to "ready", so a corrupt file
   * surfaces an error here rather than later during compression.
   */
  const capture = useCallback(async (file: File | Blob) => {
    cancelledRef.current = false;
    revokePreview();
    blobRef.current = null;
    setPreviewUrl(null);
    setEstimate(null);
    setErrorMessage(null);
    setStatus("capturing");

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      if (cancelledRef.current) return;
      setErrorMessage("Could not read the captured photo. Please try again.");
      setStatus("error");
      return;
    }
    bitmap.close();
    if (cancelledRef.current) return;

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    blobRef.current = file;
    setPreviewUrl(url);
    setStatus("ready");
  }, []);

  /**
   * Compresses the captured photo and requests an AI fill estimate. Only
   * meaningful when estimateAvailable is true (the caller should hide/disable
   * the action otherwise); always resolves to a typed result rather than
   * throwing. Returns the hook to "ready" whether the estimate succeeded,
   * came back "unavailable", or errored — a failed estimate never blocks the
   * plain attach() path.
   */
  const requestEstimate =
    useCallback(async (): Promise<EstimateVolumeResult> => {
      const blob = blobRef.current;
      if (!blob) {
        const result: EstimateVolumeResult = {
          status: "error",
          message: "No photo has been captured.",
        };
        setEstimate(result);
        return result;
      }

      setStatus("processing");
      setErrorMessage(null);

      let result: EstimateVolumeResult;
      try {
        const compressed = await compressImage(blob);
        if (cancelledRef.current || statusRef.current !== "processing") {
          return { status: "error", message: "Cancelled." };
        }
        result = await estimateVolume(compressed);
      } catch (err) {
        result = {
          status: "error",
          message:
            err instanceof PhotoCompressionError
              ? err.message
              : "Could not prepare the photo for estimation.",
        };
      }

      if (cancelledRef.current || statusRef.current !== "processing") {
        return result;
      }
      setEstimate(result);
      setStatus("ready");
      return result;
    }, []);

  /**
   * Compresses and uploads the captured photo to the drink-photos bucket
   * without requesting an AI estimate, resolving to the typed upload result
   * (storage path + normalized error, never throws). This only uploads the
   * blob and hands back its path — the caller still decides if/when to write
   * that path onto a FluidEvent and commit it via the store.
   */
  const attach = useCallback(
    async (profileId: string, eventId: string): Promise<UploadPhotoResult> => {
      const blob = blobRef.current;
      if (!blob) {
        return {
          path: null,
          error: { message: "No photo has been captured." },
        };
      }

      setStatus("processing");
      setErrorMessage(null);

      let result: UploadPhotoResult;
      try {
        const compressed = await compressImage(blob);
        if (cancelledRef.current || statusRef.current !== "processing") {
          return { path: null, error: { message: "Cancelled." } };
        }
        result = await uploadDrinkPhoto(profileId, eventId, compressed);
      } catch (err) {
        result = {
          path: null,
          error: {
            message:
              err instanceof PhotoCompressionError
                ? err.message
                : "Could not prepare the photo for upload.",
          },
        };
      }

      if (cancelledRef.current || statusRef.current !== "processing") {
        return result;
      }
      setStatus("ready");
      return result;
    },
    []
  );

  return {
    status,
    previewUrl,
    errorMessage,
    estimate,
    estimateAvailable: ESTIMATE_AVAILABLE,
    capture,
    requestEstimate,
    attach,
    reset,
    cancel,
  };
}
