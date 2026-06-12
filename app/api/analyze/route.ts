import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AnalysisError, analyzePhoto, demoAnalysis } from "@/lib/analyze-photo";
import { loadCatalog } from "@/lib/catalog";
import { buildRoutineFromMatrix, loadCodeMatrix } from "@/lib/code-matrix";
import { analyzePhotoPerfectCorp } from "@/lib/perfectcorp";
import { buildProfile } from "@/lib/profile";
import { buildRoutine } from "@/lib/recommend";
import { CONCERN_IDS, type AnalyzeRequest, type ConcernId } from "@/lib/types";

export const runtime = "nodejs";
// The vision analysis can take a while — give the function headroom on Vercel.
export const maxDuration = 60;

// Downscaled client-side to ~1024px, so anything bigger than this is suspicious.
const MAX_IMAGE_BYTES = 3_500_000;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function bad(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function validate(body: unknown): AnalyzeRequest | string {
  if (typeof body !== "object" || body === null) return "Invalid request body.";
  const b = body as Record<string, unknown>;

  if (b.consent !== true) return "Consent is required to analyze a photo.";

  const quiz = b.quiz as Record<string, unknown> | undefined;
  if (!quiz) return "Quiz answers are missing.";
  if (!["tight", "comfortable", "oily-tzone", "oily-all"].includes(quiz.feelAfterCleansing as string))
    return "Invalid quiz answer: feelAfterCleansing.";
  if (!["often", "sometimes", "rarely"].includes(quiz.sensitivity as string))
    return "Invalid quiz answer: sensitivity.";
  if (
    !Array.isArray(quiz.concerns) ||
    quiz.concerns.length > 3 ||
    quiz.concerns.some((c) => !CONCERN_IDS.includes(c as ConcernId))
  )
    return "Invalid quiz answer: concerns.";

  const image = b.image as Record<string, unknown> | undefined;
  if (image) {
    if (typeof image.data !== "string" || !MEDIA_TYPES.has(image.mediaType as string))
      return "Invalid image payload.";
    // base64 length ≈ bytes × 4/3
    if (image.data.length > (MAX_IMAGE_BYTES * 4) / 3)
      return "Photo is too large. Please try again.";
  }

  return b as unknown as AnalyzeRequest;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("invalid_json", "Invalid request body.");
  }

  const parsed = validate(body);
  if (typeof parsed === "string") return bad("invalid_request", parsed);

  // Analysis provider is swappable: Claude vision (default) or Perfect Corp.
  const provider = process.env.SKIN_ANALYZER === "perfectcorp" ? "perfectcorp" : "claude";
  const configured =
    provider === "perfectcorp"
      ? Boolean(process.env.PERFECTCORP_API_KEY)
      : Boolean(process.env.ANTHROPIC_API_KEY);
  const demo = !configured || !parsed.image;

  try {
    const analysis = demo
      ? demoAnalysis(parsed.quiz)
      : provider === "perfectcorp"
        ? await analyzePhotoPerfectCorp(parsed.image!)
        : await analyzePhoto(parsed.image!, parsed.quiz);

    const profile = buildProfile(parsed.quiz, analysis, demo);
    const { products } = loadCatalog();

    // Merchant matching table takes priority; ingredient engine is the fallback.
    const matrixRow = loadCodeMatrix()?.[profile.skinCode.code];
    if (matrixRow?.name) profile.skinCode.name = matrixRow.name;
    if (matrixRow?.tagline) profile.skinCode.tagline = matrixRow.tagline;
    const fromMatrix = matrixRow ? buildRoutineFromMatrix(matrixRow, profile, products) : [];

    let routine = buildRoutine(profile, products);
    if (fromMatrix.length > 0) {
      // The matrix owns the core steps; concern-driven bonus steps (eye, mask)
      // still come from the engine unless the matrix row covers that category.
      const bonus = routine.filter(
        (s) =>
          (s.category === "mask" || s.category === "eye") &&
          !fromMatrix.some((m) => m.category === s.category),
      );
      routine = [...fromMatrix, ...bonus];
    }

    return NextResponse.json({ profile, routine });
  } catch (err) {
    if (err instanceof AnalysisError) {
      return bad(err.code, err.message, 422);
    }
    if (
      err instanceof Anthropic.RateLimitError ||
      (err instanceof Anthropic.APIError && err.status === 529)
    ) {
      return bad("busy", "Our analyzer is busy right now — please try again in a minute.", 429);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error:", err.status, err.message);
      return bad("ai_error", "The analysis service had a hiccup. Please try again.", 502);
    }
    console.error("Analyze route error:", err);
    return bad("server_error", "Something went wrong. Please try again.", 500);
  }
}
