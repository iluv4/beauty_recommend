/**
 * Client-side image preparation: downscale + re-encode the selfie before
 * upload. Keeps payloads small (faster, cheaper vision tokens) and strips
 * EXIF metadata (incl. GPS) as a privacy side effect of re-encoding.
 */

export interface PreparedImage {
  /** base64 without the data: prefix */
  data: string;
  mediaType: "image/jpeg";
  previewUrl: string;
}

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.85;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // "from-image" applies EXIF rotation so portrait selfies stay upright.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that image."));
      };
      img.src = url;
    });
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file);
  const width = "width" in bitmap ? bitmap.width : 0;
  const height = "height" in bitmap ? bitmap.height : 0;
  if (!width || !height) throw new Error("Could not read that image.");

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) bitmap.close();

  const previewUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const data = previewUrl.split(",")[1];
  if (!data) throw new Error("Could not process that image.");

  return { data, mediaType: "image/jpeg", previewUrl };
}
