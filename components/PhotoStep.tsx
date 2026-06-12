"use client";

import { useRef, useState } from "react";
import { prepareImage, type PreparedImage } from "@/lib/image";

// AI-generated faces (no real people) bundled for demos — lets visitors try
// the flow without handing over a selfie.
const DEMO_PHOTOS = [
  { src: "/demo/face-1.jpg", label: "Oily T-zone · 20s" },
  { src: "/demo/face-2.jpg", label: "Dark spots · 30s" },
  { src: "/demo/face-3.jpg", label: "Redness · 20s" },
  { src: "/demo/face-4.jpg", label: "Fine lines · 50s" },
];

export default function PhotoStep({
  onContinue,
}: {
  onContinue: (image: PreparedImage) => void;
}) {
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      setImage(await prepareImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDemo(src: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error("Could not load the sample photo.");
      const blob = await res.blob();
      const file = new File([blob], src.split("/").pop() ?? "demo.jpg", {
        type: blob.type || "image/jpeg",
      });
      setImage(await prepareImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sample photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h2 className="font-display text-3xl">First, a selfie</h2>
      <p className="mt-2 text-muted">
        Natural light, no filters, minimal makeup — the closer to bare skin, the
        better your results.
      </p>

      <div className="mt-6">
        {image ? (
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.previewUrl}
              alt="Your selfie preview"
              className="h-56 w-56 rounded-3xl border border-line object-cover shadow-sm"
            />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setConsent(false);
              }}
              className="text-sm text-accent underline underline-offset-4"
            >
              Use a different photo
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
                className="rounded-2xl border border-line bg-surface px-4 py-6 text-center shadow-sm transition hover:border-accent disabled:opacity-50"
              >
                <span className="block text-2xl">📸</span>
                <span className="mt-2 block font-medium">Take a selfie</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => uploadRef.current?.click()}
                className="rounded-2xl border border-line bg-surface px-4 py-6 text-center shadow-sm transition hover:border-accent disabled:opacity-50"
              >
                <span className="block text-2xl">🖼️</span>
                <span className="mt-2 block font-medium">Upload a photo</span>
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
              <span className="h-px flex-1 bg-line" aria-hidden />
              No photo handy? Try a sample
              <span className="h-px flex-1 bg-line" aria-hidden />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {DEMO_PHOTOS.map((d) => (
                <button
                  key={d.src}
                  type="button"
                  disabled={busy}
                  onClick={() => handleDemo(d.src)}
                  className="group text-center disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.src}
                    alt={`Sample face: ${d.label}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-2xl border border-line object-cover shadow-sm transition group-hover:border-accent"
                  />
                  <span className="mt-1.5 block text-[11px] leading-tight text-muted">
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">
              Samples are AI-generated faces — not real people.
            </p>
          </>
        )}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {busy && <p className="mt-4 text-sm text-muted animate-pulse-soft">Preparing photo…</p>}
      {error && <p className="mt-4 text-sm text-accent-deep">{error}</p>}

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <span className="text-muted">
          I agree to have my photo analyzed by AI to generate skincare
          suggestions. It&apos;s processed in real time and{" "}
          <strong className="text-foreground">never stored</strong>.
        </span>
      </label>

      <button
        type="button"
        disabled={!image || !consent}
        onClick={() => image && onContinue(image)}
        className="mt-6 w-full rounded-full bg-accent px-6 py-3.5 font-medium text-white shadow-sm transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
