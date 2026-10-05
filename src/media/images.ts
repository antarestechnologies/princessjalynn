import sharp from "sharp";

export const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ProcessedImage {
  /** Re-encoded original: EXIF/GPS stripped, capped at 2560px on the long edge. */
  original: { data: Buffer; contentType: "image/jpeg"; width: number; height: number };
  /** Feed/post poster, max 1280px wide. */
  thumbnail: { data: Buffer; contentType: "image/jpeg" };
  /** Locked-state preview: tiny, heavily blurred, then shown upscaled. No detail survives. */
  blurred: { data: Buffer; contentType: "image/jpeg" };
}

/**
 * Every upload is re-encoded. That drops camera metadata (location, device, timestamps)
 * which protects the creator, and normalizes formats for the browser.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const base = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("not an image");

  const original = await base
    .clone()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const thumbnail = await base
    .clone()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const blurred = await blurForPreview(input);

  return {
    original: {
      data: original.data,
      contentType: "image/jpeg",
      width: original.info.width,
      height: original.info.height,
    },
    thumbnail: { data: thumbnail, contentType: "image/jpeg" },
    blurred: { data: blurred, contentType: "image/jpeg" },
  };
}

/** Also used for video poster frames fetched from the provider. */
export async function blurForPreview(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 48, height: 48, fit: "inside" })
    .blur(6)
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: 50 })
    .toBuffer();
}

export async function posterFromBuffer(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}
