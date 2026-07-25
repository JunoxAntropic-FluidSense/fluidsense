import { useEffect, useState } from "react";
import { getDrinkPhotoSignedUrl } from "../lib/photo/storage";

type PhotoThumbnailSize = "sm" | "md";

const SIZE_CLASSES: Record<PhotoThumbnailSize, string> = {
  sm: "w-10 h-10 text-sm",
  md: "w-24 h-24 text-2xl",
};

/**
 * Neutral, status-agnostic indicator for an attached drink photo. Deliberately
 * does NOT reuse StatusBadge's status colors (intake green / amber / fog) or
 * its ✓/≈/— icons (src/components/ui/Badge.tsx) — a photo's presence must
 * never visually suggest a measurement status the entry doesn't have
 * (CLAUDE.md hard rule 1: never blur measured and guessed).
 *
 * Shows a plain navy/fog camera-icon chip while the signed URL loads or if
 * it fails to resolve (e.g. Storage unreachable) — never throws, never
 * crashes the caller.
 */
export function PhotoThumbnail({
  path,
  size = "sm",
  alt = "Attached photo",
}: {
  path: string;
  size?: PhotoThumbnailSize;
  alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    getDrinkPhotoSignedUrl(path)
      .then((result) => {
        if (cancelled) return;
        if (result.signedUrl) {
          setUrl(result.signedUrl);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const dims = SIZE_CLASSES[size];

  if (url) {
    return (
      <img
        src={url}
        alt={alt}
        className={`${dims} rounded-lg object-cover border border-navy-900/10 shrink-0`}
      />
    );
  }

  return (
    <span
      className={`${dims} rounded-lg bg-fog-100 text-navy-500 flex items-center justify-center shrink-0`}
      role="img"
      aria-label={failed ? "Photo unavailable" : "Loading photo"}
      title={failed ? "Photo unavailable" : "Loading photo…"}
    >
      <span aria-hidden="true">📷</span>
    </span>
  );
}
