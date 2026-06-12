"use client";

import { CONCERN_LABELS } from "@/lib/ingredients";
import type { AnalyzeResponse, Recommendation, SkinCode, SkinProfile } from "@/lib/types";

const SOURCE_BADGE: Record<string, string> = {
  photo: "seen in photo",
  quiz: "you told us",
  both: "photo + quiz",
};

function SkinCodeCard({ skinCode }: { skinCode: SkinCode }) {
  return (
    <section className="rounded-3xl bg-foreground p-6 text-background shadow-sm sm:p-8">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-background/60">
        Your Skin Code
      </p>

      <div className="mt-5 flex justify-center gap-2 sm:gap-3">
        {skinCode.axes.map((a) => (
          <div
            key={a.axis}
            className="flex w-[4.5rem] flex-col items-center rounded-2xl bg-background/10 px-2 py-3 sm:w-20"
          >
            <span className="font-display text-3xl sm:text-4xl">{a.letter}</span>
            <span className="mt-1 text-[10px] uppercase tracking-wide text-background/70">
              {a.label}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-center font-display text-3xl">{skinCode.name}</h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-background/75">
        {skinCode.tagline}
      </p>

      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-background/15 pt-5 text-sm sm:grid-cols-2">
        {skinCode.axes.map((a) => (
          <div key={a.axis}>
            <dt className="font-medium">
              {a.letter} · {a.label}
            </dt>
            <dd className="mt-0.5 text-background/70">{a.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProfileCard({ profile }: { profile: SkinProfile }) {
  return (
    <section className="mt-6 rounded-3xl border border-line bg-surface p-6 shadow-sm">
      <h2 className="font-display text-2xl">The details</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium capitalize text-white">
          {profile.skinType} skin
        </span>
        <span className="rounded-full bg-accent-soft px-4 py-1.5 text-sm capitalize">
          {profile.sensitivity} sensitivity
        </span>
        {profile.tone && (
          <span className="rounded-full bg-accent-soft px-4 py-1.5 text-sm">
            Tone {profile.tone.fitzpatrick} · {profile.tone.undertone} undertone
          </span>
        )}
      </div>

      {profile.tone && <p className="mt-3 text-sm text-muted">{profile.tone.description}</p>}

      <p className="mt-4 border-l-2 border-accent pl-4 font-display text-lg leading-relaxed">
        {profile.summary}
      </p>

      {profile.concerns.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
            What we&apos;re targeting
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {profile.concerns.map((c) => (
              <li
                key={c.id}
                className="rounded-full border border-line bg-background px-3 py-1.5 text-sm capitalize"
              >
                {CONCERN_LABELS[c.id]}
                <span className="ml-2 text-xs lowercase text-muted">{SOURCE_BADGE[c.source]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ProductCard({ rec }: { rec: Recommendation }) {
  const { product } = rec;
  return (
    <article className="flex gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          className="h-24 w-24 shrink-0 rounded-xl border border-line object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-display text-3xl text-accent">
          {product.title.charAt(0)}
        </div>
      )}

      <div className="min-w-0">
        {product.vendor && (
          <p className="text-xs uppercase tracking-wide text-muted">{product.vendor}</p>
        )}
        <h4 className="font-medium leading-snug">{product.title}</h4>
        <p className="mt-1 text-sm text-muted">{rec.why}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">
            ${product.price}{" "}
            <span className="text-xs text-muted">{product.currencyCode}</span>
          </span>
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-deep"
            >
              View product →
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Results({
  data,
  onRestart,
}: {
  data: AnalyzeResponse;
  onRestart: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      {data.profile.demo && (
        <p className="mb-4 rounded-2xl border border-dashed border-accent bg-accent-soft px-4 py-3 text-sm">
          <strong>Demo mode</strong> — results are built from your quiz only. Connect an
          AI key to unlock real photo analysis.
        </p>
      )}

      <SkinCodeCard skinCode={data.profile.skinCode} />

      <ProfileCard profile={data.profile} />

      <section className="mt-8">
        <h2 className="font-display text-2xl">
          Your {data.profile.skinCode.code} routine
        </h2>
        <p className="mt-1 text-sm text-muted">
          Every pick is matched to your profile through its key ingredients.
        </p>

        <div className="mt-5 space-y-7">
          {data.routine.map((step) => (
            <div key={step.step}>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
                {step.step}
              </h3>
              <div className="space-y-3">
                {step.picks.map((rec) => (
                  <ProductCard key={rec.product.id} rec={rec} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium transition hover:border-accent"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
