"use client";

import { useState } from "react";
import { CONCERN_LABELS } from "@/lib/ingredients";
import type { ConcernId, QuizAnswers } from "@/lib/types";

const FEEL_OPTIONS: { value: QuizAnswers["feelAfterCleansing"]; label: string }[] = [
  { value: "tight", label: "Tight or flaky" },
  { value: "comfortable", label: "Comfortable" },
  { value: "oily-tzone", label: "Shiny T-zone only" },
  { value: "oily-all", label: "Shiny all over" },
];

const SENSITIVITY_OPTIONS: { value: QuizAnswers["sensitivity"]; label: string }[] = [
  { value: "often", label: "Often — it stings or turns red easily" },
  { value: "sometimes", label: "Sometimes, with certain products" },
  { value: "rarely", label: "Rarely — pretty resilient" },
];

const AGE_OPTIONS: { value: NonNullable<QuizAnswers["ageRange"]>; label: string }[] = [
  { value: "under-20", label: "Under 20" },
  { value: "20s", label: "20s" },
  { value: "30s", label: "30s" },
  { value: "40s", label: "40s" },
  { value: "50-plus", label: "50+" },
];

const CONCERN_OPTIONS = Object.entries(CONCERN_LABELS) as [ConcernId, string][];

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
        selected
          ? "border-accent bg-accent-soft font-medium"
          : "border-line bg-surface hover:border-accent/50"
      }`}
    >
      {children}
    </button>
  );
}

export default function QuizStep({ onSubmit }: { onSubmit: (quiz: QuizAnswers) => void }) {
  const [feel, setFeel] = useState<QuizAnswers["feelAfterCleansing"] | null>(null);
  const [sensitivity, setSensitivity] = useState<QuizAnswers["sensitivity"] | null>(null);
  const [concerns, setConcerns] = useState<ConcernId[]>([]);
  const [ageRange, setAgeRange] = useState<QuizAnswers["ageRange"]>(undefined);

  function toggleConcern(id: ConcernId) {
    setConcerns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  }

  const ready = feel && sensitivity && concerns.length > 0;

  return (
    <div className="mx-auto w-full max-w-md">
      <h2 className="font-display text-3xl">Four quick questions</h2>
      <p className="mt-2 text-muted">
        Photos show a lot — but these answers complete your Skin Code.
      </p>

      <section className="mt-7">
        <h3 className="font-medium">1. A few hours after cleansing, your skin feels…</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {FEEL_OPTIONS.map((o) => (
            <OptionButton key={o.value} selected={feel === o.value} onClick={() => setFeel(o.value)}>
              {o.label}
            </OptionButton>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h3 className="font-medium">2. Does your skin react to new products?</h3>
        <div className="mt-3 grid gap-2">
          {SENSITIVITY_OPTIONS.map((o) => (
            <OptionButton
              key={o.value}
              selected={sensitivity === o.value}
              onClick={() => setSensitivity(o.value)}
            >
              {o.label}
            </OptionButton>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h3 className="font-medium">
          3. What bothers you most?{" "}
          <span className="text-sm font-normal text-muted">(pick up to 3)</span>
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONCERN_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => toggleConcern(id)}
              className={`rounded-full border px-4 py-2 text-sm capitalize transition ${
                concerns.includes(id)
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface hover:border-accent/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h3 className="font-medium">
          4. Your age range <span className="text-sm font-normal text-muted">(optional)</span>
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setAgeRange(ageRange === o.value ? undefined : o.value)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                ageRange === o.value
                  ? "border-accent bg-accent-soft font-medium"
                  : "border-line bg-surface hover:border-accent/50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={!ready}
        onClick={() =>
          ready && onSubmit({ feelAfterCleansing: feel, sensitivity, concerns, ageRange })
        }
        className="mt-8 w-full rounded-full bg-accent px-6 py-3.5 font-medium text-white shadow-sm transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        Analyze my skin
      </button>
    </div>
  );
}
