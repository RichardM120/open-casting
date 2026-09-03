/**
 * Shrinks a picture in the browser before it is uploaded.
 *
 * A header image or logo is shown at most 1600px wide, and a phone shows it
 * far smaller, so a 12 MB photograph straight off a camera is waste: it costs
 * to store, costs again every time an applicant's page loads it, and loads
 * slowly on a phone. The picture is redrawn no larger than the limit and
 * re-encoded as WebP (JPEG where the browser cannot write WebP), which cuts
 * most photographs to a tenth of their size with no visible loss.
 *
 * SVG is left alone: it is already as small as it gets and scales to any
 * screen without redrawing. Anything the browser cannot decode is also left
 * alone, and the store's own limits still apply.
 */

export const IMAGE_LIMITS = {
  /** The longest edge of a header image, in pixels. Twice a phone's width. */
  longestEdge: 1600,
  /** WebP and JPEG quality, 0 to 1. */
  quality: 0.82,
} as const;

export type Shrunk = {
  file: File;
  width: number;
  height: number;
  /** Bytes before and after, for the caller to say what happened. */
  before: number;
  after: number;
};

export async function shrinkImage(
  source: File,
  limits: { longestEdge?: number; quality?: number } = {},
): Promise<Shrunk> {
  const longestEdge = limits.longestEdge ?? IMAGE_LIMITS.longestEdge;
  const quality = limits.quality ?? IMAGE_LIMITS.quality;

  if (source.type === "image/svg+xml" || typeof createImageBitmap !== "function") {
    return { file: source, width: 0, height: 0, before: source.size, after: source.size };
  }

  let bitmap: ImageBitmap;
  try {
    // EXIF orientation is applied here, so a portrait phone photo stays upright.
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    return { file: source, width: 0, height: 0, before: source.size, after: source.size };
  }

  const scale = Math.min(1, longestEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { file: source, width: bitmap.width, height: bitmap.height, before: source.size, after: source.size };
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encoded = (await encode(canvas, "image/webp", quality)) ?? (await encode(canvas, "image/jpeg", quality));
  if (!encoded) {
    return { file: source, width, height, before: source.size, after: source.size };
  }

  // A picture that was already small and well compressed can come out larger
  // than it went in; then the original is the better file.
  if (scale === 1 && encoded.size >= source.size) {
    return { file: source, width, height, before: source.size, after: source.size };
  }

  const extension = encoded.type === "image/webp" ? "webp" : "jpg";
  const name = `${source.name.replace(/\.[^.]+$/, "") || "image"}.${extension}`;
  const file = new File([encoded], name, { type: encoded.type });
  return { file, width, height, before: source.size, after: file.size };
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob && blob.type === type ? blob : null), type, quality);
  });
}

/**
 * Whether a picture is a logo or a banner, by its shape: anything wider than
 * three to two is a banner across the top of the page, anything squarer sits
 * centred like a logo. The casting director can override the guess.
 */
export function guessImageKind(width: number, height: number): "banner" | "logo" {
  if (!width || !height) return "banner";
  return width / height >= 1.5 ? "banner" : "logo";
}
