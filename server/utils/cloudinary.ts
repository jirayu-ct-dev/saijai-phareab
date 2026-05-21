import { v2 as cloudinary } from "cloudinary";

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

let isCloudinaryConfigured = false;

const ensureCloudinaryConfigured = (): void => {
  if (isCloudinaryConfigured) {
    return;
  }

  cloudinary.config({
    cloud_name: getRequiredEnv("CLOUDINARY_NAME"),
    api_key: getRequiredEnv("CLOUDINARY_API_KEY"),
    api_secret: getRequiredEnv("CLOUDINARY_API_SECRET"),
    secure: true,
  });

  isCloudinaryConfigured = true;
};

export const uploadImageBufferToCloudinary = async (
  buffer: Buffer,
  options: {
    folder?: string;
    publicId: string;
    resourceType?: "image";
  },
): Promise<{ assetId: string | null; publicId: string | null; secureUrl: string; url: string | null }> => {
  ensureCloudinaryConfigured();

  const result = await new Promise<{
    asset_id?: string;
    public_id?: string;
    secure_url: string;
    url?: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        overwrite: true,
        resource_type: options.resourceType ?? "image",
      },
      (error, uploadResult) => {
        if (error) {
          reject(error);
          return;
        }

        if (!uploadResult?.secure_url) {
          reject(new Error("Cloudinary upload response missing secure_url"));
          return;
        }

        resolve({
          asset_id: uploadResult.asset_id,
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url,
          url: uploadResult.url,
        });
      },
    );

    stream.end(buffer);
  });

  return {
    assetId: result.asset_id ?? null,
    publicId: result.public_id ?? null,
    secureUrl: result.secure_url,
    url: result.url ?? null,
  };
};

export const deleteImageFromCloudinary = async (publicId: string): Promise<void> => {
  ensureCloudinaryConfigured();
  await cloudinary.uploader.destroy(publicId);
};

