import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage } from "./images";

async function sampleJpeg(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 90 } } })
    .jpeg()
    .withMetadata({
      exif: { IFD0: { Copyright: "secret-camera-owner", ImageDescription: "gps-ish" } },
    })
    .toBuffer();
}

describe("processImage", () => {
  it("re-encodes, caps size, produces a poster and a tiny blurred preview, and strips metadata", async () => {
    const input = await sampleJpeg(4000, 3000);
    expect(input.toString("latin1")).toContain("secret-camera-owner");
    const out = await processImage(input);
    expect(out.original.width).toBe(2560);
    expect(out.original.height).toBe(1920);
    expect(out.original.data.toString("latin1")).not.toContain("secret-camera-owner");
    const thumb = await sharp(out.thumbnail.data).metadata();
    expect(thumb.width).toBe(1280);
    const blur = await sharp(out.blurred.data).metadata();
    expect(blur.width).toBeLessThanOrEqual(480);
    expect(out.blurred.data.length).toBeLessThan(out.thumbnail.data.length);
  });

  it("rejects non-images", async () => {
    await expect(processImage(Buffer.from("not an image at all"))).rejects.toThrow();
  });
});
