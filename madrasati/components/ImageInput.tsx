"use client";
import { useRef, useState } from "react";
import { fileToAttachment, type PickedImage } from "@/lib/client/image";
import { Button } from "./ui";
import { InboxChips, LibraryPickerDialog } from "./LibraryPicker";

export function ImageInput({
  images,
  onChange,
  max = 4,
  compact = false,
  allowPdf = false,
  label,
}: {
  images: PickedImage[];
  onChange: (imgs: PickedImage[]) => void;
  max?: number;
  compact?: boolean;
  allowPdf?: boolean;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const full = images.length >= max;
  const addOne = (img: PickedImage) => {
    if (images.length >= max) return setError(`تقدر ترفع ${max} مرفقات كحد أقصى.`);
    onChange([...images.filter((i) => i.id !== img.id), img]);
  };

  async function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    try {
      const list = Array.from(files).slice(0, Math.max(0, max - images.length));
      if (!list.length) throw new Error(`تقدر ترفع ${max} صور كحد أقصى.`);
      const picked = await Promise.all(list.map((f) => fileToAttachment(f, allowPdf)));
      onChange([...images, ...picked]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ما قدرنا نضيف الصورة.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      if (camRef.current) camRef.current.value = "";
    }
  }

  return (
    <div
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/") || (allowPdf && f.type === "application/pdf"));
        if (files.length) {
          e.preventDefault();
          e.stopPropagation();
          void addFiles(files);
        }
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept={allowPdf ? "image/*,application/pdf" : "image/*"}
        multiple
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
        data-testid="image-file"
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy || images.length >= max}
          aria-label={label ?? (allowPdf ? "ارفع صورة أو PDF" : "ارفع صورة")}
        >
          {allowPdf ? "📎" : "🖼️"} {compact ? "" : (label ?? (allowPdf ? "ارفع صورة أو PDF" : "ارفع صورة"))}
        </Button>
        {!compact && (
          <Button
            variant="secondary"
            size="sm"
            className="sm:hidden"
            onClick={() => camRef.current?.click()}
            disabled={busy || images.length >= max}
          >
            📷 صوّر
          </Button>
        )}
        {allowPdf && (
          <Button variant="secondary" size="sm" onClick={() => setPicker(true)} disabled={full} aria-label="صفحات من مكتبة الوزارة">
            📚 {compact ? "" : "من كتب الوزارة"}
          </Button>
        )}
        {busy && <span className="text-sm text-slate-500">جاري تجهيز الملف…</span>}
      </div>
      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="group relative">
              {img.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.preview}
                  alt="صورة مرفقة"
                  className="size-20 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                />
              ) : (
                <div
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-red-50 p-1 text-center dark:border-slate-700 dark:bg-red-950/30"
                  title={img.name}
                  data-testid="pdf-chip"
                >
                  <span className="text-2xl" aria-hidden>
                    📄
                  </span>
                  <span className="w-full truncate text-[10px] text-slate-600 dark:text-slate-300">{img.name ?? "PDF"}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onChange(images.filter((i) => i.id !== img.id))}
                className="absolute -top-2 -left-2 flex size-6 items-center justify-center rounded-full bg-slate-800 text-xs text-white shadow"
                aria-label="احذف المرفق"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {allowPdf && !full && <InboxChips onTake={addOne} />}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {picker && <LibraryPickerDialog onClose={() => setPicker(false)} onAdd={addOne} />}
    </div>
  );
}
