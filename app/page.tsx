"use client";

import { useEffect, useState } from "react";
import PhotoStep from "@/components/PhotoStep";
import QuizStep from "@/components/QuizStep";
import Results from "@/components/Results";
import type { PreparedImage } from "@/lib/image";
import type { AnalyzeResponse, QuizAnswers } from "@/lib/types";

type Step = "intro" | "photo" | "quiz" | "analyzing" | "results";

const ANALYZING_MESSAGES = [
  "Reading your photo…",
  "Looking at tone and texture…",
  "Matching concerns to ingredients…",
  "Building your routine…",
];

function AnalyzingScreen() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % ANALYZING_MESSAGES.length), 2800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft">
        <span className="animate-pulse-soft text-3xl">✨</span>
      </div>
      <h2 className="mt-6 font-display text-2xl">{ANALYZING_MESSAGES[i]}</h2>
      <p className="mt-2 text-sm text-muted">This usually takes under a minute.</p>
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto w-full max-w-md text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
        AI Skin Analysis
      </p>
      <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
        Your skin, decoded.
      </h1>
      <p className="mt-4 text-muted">
        One selfie and four quick questions. We&apos;ll read your skin, then build a
        routine matched ingredient-by-ingredient to what it actually needs.
      </p>

      <ul className="mx-auto mt-8 max-w-xs space-y-3 text-left text-sm">
        {[
          "Takes about two minutes",
          "Photo analyzed in real time — never stored",
          "Every product pick explained, ingredient by ingredient",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3">
            <span className="mt-0.5 text-accent">✓</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onStart}
        className="mt-9 w-full rounded-full bg-accent px-6 py-3.5 font-medium text-white shadow-sm transition hover:bg-accent-deep"
      >
        Start my analysis
      </button>
      <p className="mt-4 text-xs text-muted">
        For cosmetic guidance only — not medical advice.
      </p>
    </div>
  );
}

const STEP_LABELS: { key: Step[]; label: string }[] = [
  { key: ["photo"], label: "Photo" },
  { key: ["quiz", "analyzing"], label: "Quiz" },
  { key: ["results"], label: "Results" },
];

export default function Home() {
  const [step, setStep] = useState<Step>("intro");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<{ message: string; retryTo: Step } | null>(null);

  async function analyze(quiz: QuizAnswers) {
    setStep("analyzing");
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          quiz,
          image: image ? { data: image.data, mediaType: image.mediaType } : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message = body?.error?.message ?? "Something went wrong. Please try again.";
        const code = body?.error?.code;
        setError({
          message,
          retryTo: code === "not_a_face" || code === "refused" ? "photo" : "quiz",
        });
        setStep(code === "not_a_face" || code === "refused" ? "photo" : "quiz");
        return;
      }
      setResult(body as AnalyzeResponse);
      setStep("results");
    } catch {
      setError({ message: "Network hiccup — please try again.", retryTo: "quiz" });
      setStep("quiz");
    }
  }

  function restart() {
    setStep("intro");
    setImage(null);
    setResult(null);
    setError(null);
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface/60">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-4">
          <button type="button" onClick={restart} className="font-display text-lg tracking-wide">
            Skin Studio
          </button>
          {step !== "intro" && (
            <ol className="flex items-center gap-4 text-xs uppercase tracking-wide text-muted">
              {STEP_LABELS.map((s, i) => (
                <li
                  key={s.label}
                  className={s.key.includes(step) ? "font-semibold text-accent" : ""}
                >
                  {i + 1} · {s.label}
                </li>
              ))}
            </ol>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        {error && step !== "analyzing" && (
          <p className="mx-auto mb-6 w-full max-w-md rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
            {error.message}
          </p>
        )}

        {step === "intro" && <Intro onStart={() => setStep("photo")} />}
        {step === "photo" && (
          <PhotoStep
            onContinue={(img) => {
              setImage(img);
              setError(null);
              setStep("quiz");
            }}
          />
        )}
        {step === "quiz" && <QuizStep onSubmit={analyze} />}
        {step === "analyzing" && <AnalyzingScreen />}
        {step === "results" && result && <Results data={result} onRestart={restart} />}
      </div>

      <footer className="border-t border-line">
        <p className="mx-auto w-full max-w-2xl px-5 py-4 text-center text-xs text-muted">
          Results are general cosmetic guidance, not medical advice. Photos are
          analyzed in real time and never stored. Patch-test new products before use.
        </p>
      </footer>
    </main>
  );
}
