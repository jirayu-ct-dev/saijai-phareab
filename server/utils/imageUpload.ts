const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_PATTERN = /^image\/(jpe?g|png|webp)$/;

export type ImageUploadPart = {
  data?: Buffer | undefined;
  type?: string | undefined;
};

export type ImageUploadRejection = {
  statusCode: 400 | 413;
  statusMessage: string;
};

function sniffImageMime(data: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString("latin1") === "RIFF" &&
    data.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Validate a multipart image upload: the declared MIME type must be
 * JPEG/PNG/WebP, the actual bytes must match one of those formats (the
 * multipart Content-Type is client-supplied and spoofable), and the size
 * must stay within 5MB. Returns null when valid; otherwise a rejection the
 * caller converts to an H3 error (keeps this module free of h3 so tests can
 * import it directly).
 */
export function validateImageUpload(file: ImageUploadPart | undefined): ImageUploadRejection | null {
  if (!file?.data?.length) {
    return { statusCode: 400, statusMessage: "กรุณาเลือกไฟล์ภาพ" };
  }
  const declaredType = (file.type || "").toLowerCase();
  if (!IMAGE_MIME_PATTERN.test(declaredType)) {
    return { statusCode: 400, statusMessage: "รองรับเฉพาะไฟล์ภาพ JPEG / PNG / WebP" };
  }
  if (file.data.length > MAX_IMAGE_UPLOAD_BYTES) {
    return { statusCode: 413, statusMessage: "ไฟล์เกินขนาดสูงสุด 5MB" };
  }
  if (sniffImageMime(file.data) === null) {
    return { statusCode: 400, statusMessage: "เนื้อหาไฟล์ไม่ใช่รูปภาพที่รองรับ" };
  }
  return null;
}
