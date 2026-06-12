import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CONCERN_IDS, type PhotoAnalysis, type QuizAnswers } from "./types";
import { CONCERN_LABELS } from "./ingredients";

/**
 * Claude vision call: one selfie in → structured cosmetic skin analysis out.
 *
 * Privacy: the image is forwarded to the Claude API for inference and is
 * never written to disk, logged, or stored by this app.
 */

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";

const PhotoAnalysisSchema = z.object({
  isFace: z
    .boolean()
    .describe("True only if the photo clearly shows one human face suitable for analysis."),
  imageQuality: z.object({
    ok: z.boolean(),
    issues: z
      .array(z.enum(["blurry", "low-light", "overexposed", "heavy-makeup", "filter-suspected", "partial-face", "too-far"]))
      .describe("Anything that reduces confidence in the analysis. Empty when the photo is good."),
  }),
  skinTone: z.object({
    fitzpatrick: z.enum(["I", "II", "III", "IV", "V", "VI"]),
    undertone: z.enum(["warm", "cool", "neutral"]),
    description: z.string().describe("One short sentence describing the apparent tone, e.g. 'Light-medium with warm, golden undertones.'"),
  }),
  findings: z
    .array(
      z.object({
        id: z.enum(CONCERN_IDS),
        severity: z.enum(["none", "mild", "moderate", "prominent"]),
        note: z.string().describe("One short sentence: what is visible and where."),
      }),
    )
    .describe("One entry per characteristic that is actually visible (severity mild or above). Omit characteristics that are not noticeable."),
  scores: z
    .object(
      Object.fromEntries(
        CONCERN_IDS.map((id) => [id, z.number()]),
      ) as Record<(typeof CONCERN_IDS)[number], z.ZodNumber>,
    )
    .describe(
      "Condition score for EVERY metric (0-100, higher = better condition), consistent with findings: prominent ≈ 30-45, moderate ≈ 45-60, mild ≈ 60-75, not noticeable ≈ 75-95. Typical healthy skin sits at 70-90; reserve <40 and >95 for clear cases.",
    ),
  summary: z
    .string()
    .describe("2-3 warm, encouraging sentences addressed to the customer ('you/your'). US English. No medical claims, no product names."),
});

const SYSTEM_PROMPT = `You are the skin analysis engine inside a skincare store's online "skin quiz". A customer has uploaded one selfie, with consent, so the store can suggest suitable skincare products.

Your job is to describe visible, surface-level, cosmetic characteristics of the skin — the kind of observations an experienced beauty advisor would make at a counter.

Rules:
- This is cosmetic guidance, not healthcare. Never name or imply medical conditions (no "acne vulgaris", "rosacea", "eczema", "melasma", etc.). Use plain cosmetic language: breakouts, redness, dark spots.
- Report only what is actually visible. It is normal and good for most characteristics to be absent — do not pad the findings list. Severity "prominent" should be rare.
- Makeup, filters, and lighting can hide or exaggerate characteristics. If you suspect any of these, list them in imageQuality.issues and be conservative with findings.
- If the photo does not clearly show a human face, set isFace=false, imageQuality.ok=false, and return an empty findings list.
- fitzpatrick/undertone are estimates of apparent tone from this photo, used only for shade and formula guidance.
- scores rate the CURRENT visible condition of each metric (100 = excellent). They must agree with findings, and metrics without findings should land in the healthy 75-95 band.
- Base findings ONLY on the photo. The customer's quiz answers are provided purely as context so your summary reads coherently — never copy a quiz concern into findings unless you can see it.
- The summary must be kind and confidence-building, mention 1-2 genuine strengths of the skin, and stay free of medical claims.`;

export class AnalysisError extends Error {
  constructor(
    public code: "not_a_face" | "refused" | "ai_error",
    message: string,
  ) {
    super(message);
  }
}

export async function analyzePhoto(
  image: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" },
  quiz: QuizAnswers,
): Promise<PhotoAnalysis> {
  const client = new Anthropic();

  const quizContext = [
    `- Skin feel a few hours after cleansing: ${quiz.feelAfterCleansing}`,
    `- Self-reported reactivity/sensitivity: ${quiz.sensitivity}`,
    `- Concerns they selected: ${quiz.concerns.map((c) => CONCERN_LABELS[c]).join(", ") || "none"}`,
    quiz.ageRange ? `- Age range: ${quiz.ageRange}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // "medium" keeps the widget responsive for shoppers; raise to "high" for more nuance.
    output_config: {
      effort: "medium",
      format: zodOutputFormat(PhotoAnalysisSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.data },
          },
          {
            type: "text",
            text: `Customer quiz context (self-reported — for the summary only, NOT a source of findings):\n${quizContext}\n\nAnalyze the attached selfie.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new AnalysisError(
      "refused",
      "We couldn't analyze this photo. Please try a different, clear photo of your face.",
    );
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new AnalysisError("ai_error", "The analysis didn't complete. Please try again.");
  }

  if (!parsed.isFace) {
    throw new AnalysisError(
      "not_a_face",
      "We couldn't find a clear face in that photo. Try a well-lit, front-facing selfie without filters.",
    );
  }

  return parsed;
}

/**
 * Deterministic stand-in used when ANTHROPIC_API_KEY isn't configured, so the
 * whole flow (quiz → profile → recommendations) can be demoed end to end.
 */
export function demoAnalysis(quiz: QuizAnswers): PhotoAnalysis {
  const findings: PhotoAnalysis["findings"] = quiz.concerns.map((id, i) => ({
    id,
    severity: i === 0 ? "moderate" : "mild",
    note: `Self-reported in your quiz: ${CONCERN_LABELS[id]}.`,
  }));

  const scores = Object.fromEntries(
    CONCERN_IDS.map((id) => {
      const idx = quiz.concerns.indexOf(id);
      return [id, idx === 0 ? 55 : idx > 0 ? 65 : 82];
    }),
  ) as PhotoAnalysis["scores"];

  return {
    isFace: true,
    imageQuality: { ok: true, issues: [] },
    skinTone: {
      fitzpatrick: "III",
      undertone: "neutral",
      description: "Demo mode — tone analysis runs once the AI key is connected.",
    },
    findings,
    scores,
    summary:
      "This is a demo result built from your quiz answers — connect the AI key to unlock real photo analysis. Your routine below is still matched ingredient-by-ingredient to the concerns you told us about.",
  };
}
