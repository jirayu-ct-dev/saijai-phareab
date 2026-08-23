import { describe, expect, it } from "vitest";
import { validateImageUpload } from "../../server/utils/imageUpload";

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const pngBytes = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  Buffer.alloc(8),
]);
const webpBytes = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.alloc(4),
  Buffer.from("WEBP", "latin1"),
]);

describe("validateImageUpload", () => {
  it("accepts real JPEG/PNG/WebP bytes with matching declared type", () => {
    expect(validateImageUpload({ data: jpegBytes, type: "image/jpeg" })).toBeNull();
    expect(validateImageUpload({ data: jpegBytes, type: "image/JPG" })).toBeNull();
    expect(validateImageUpload({ data: pngBytes, type: "image/png" })).toBeNull();
    expect(validateImageUpload({ data: webpBytes, type: "image/webp" })).toBeNull();
  });

  it("rejects missing files and unsupported declared types", () => {
    expect(validateImageUpload(undefined)?.statusCode).toBe(400);
    expect(validateImageUpload({ data: Buffer.alloc(0), type: "image/png" })?.statusCode).toBe(400);
    expect(validateImageUpload({ data: jpegBytes, type: "application/pdf" })?.statusCode).toBe(400);
    expect(validateImageUpload({ data: jpegBytes, type: "image/svg+xml" })?.statusCode).toBe(400);
  });

  it("rejects spoofed content: declared image but non-image bytes", () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const rejection = validateImageUpload({ data: exe, type: "image/png" });
    expect(rejection?.statusCode).toBe(400);
    expect(rejection?.statusMessage).toContain("เนื้อหาไฟล์");
  });

  it("rejects files over 5MB", () => {
    const big = Buffer.concat([jpegBytes, Buffer.alloc(5 * 1024 * 1024 + 1)]);
    expect(validateImageUpload({ data: big, type: "image/jpeg" })?.statusCode).toBe(413);
  });
});
