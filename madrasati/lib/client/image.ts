import type { ImageData } from "@/lib/constants";

const MAX_SIDE = 1568; // أنسب حجم لقراءة الصور
const MAX_FILE = 15 * 1024 * 1024;

export interface PickedImage extends ImageData {
  id: string;
  preview: string; // data URL
}

/** يصغّر الصورة ويحولها JPEG قبل الإرسال */
export async function fileToImage(file: File): Promise<PickedImage> {
  if (!file.type.startsWith("image/")) throw new Error("الملف المختار مو صورة.");
  if (file.size > MAX_FILE) throw new Error("الصورة أكبر من ١٥ ميغابايت.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("ما قدرنا نفتح الصورة. جرّب صيغة JPG أو PNG."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return {
      id: Math.random().toString(36).slice(2),
      media_type: "image/jpeg",
      data: dataUrl.split(",")[1],
      preview: dataUrl,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const toPayload = (imgs: PickedImage[]): ImageData[] => imgs.map(({ media_type, data }) => ({ media_type, data }));
