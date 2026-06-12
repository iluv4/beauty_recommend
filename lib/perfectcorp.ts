import crypto from "node:crypto";
import { CONCERN_IDS, type ConcernId, type PhotoAnalysis, type Severity } from "./types";
import { CONCERN_LABELS } from "./ingredients";

/**
 * Perfect Corp (YouCam) AI Skin Analysis adapter.
 *
 * Activate with:
 *   SKIN_ANALYZER=perfectcorp
 *   PERFECTCORP_API_KEY=...            (client/API key from the PC console)
 *   PERFECTCORP_SECRET_KEY=...         (RSA public key, only for the classic
 *                                       client_id + id_token auth scheme)
 *
 * ⚠️ Written against Perfect Corp's published S2S flow
 * (auth → request upload URL → upload → create task → poll task), but this
 * was authored in a sandbox that cannot reach docs.perfectcorp.com — verify
 * the endpoint paths and payload field names against
 * https://docs.perfectcorp.com/reference/ai_skin_analysis before relying on
 * it in production. The metric mapping below (PC metric → our taxonomy) is
 * the durable part and won't need to change.
 */

const BASE = process.env.PERFECTCORP_BASE_URL ?? "https://yce-api-01.perfectcorp.com";

/** PC HD skin-analysis metrics → our concern taxonomy. */
const PC_METRIC_TO_CONCERN: Record<string, ConcernId> = {
  hd_wrinkle: "fine-lines",
  hd_pore: "visible-pores",
  hd_texture: "texture",
  hd_acne: "breakouts",
  hd_redness: "redness",
  hd_oiliness: "oiliness",
  hd_moisture: "dryness",
  hd_dark_circle: "dark-circles",
  hd_age_spot: "dark-spots",
  hd_radiance: "dullness",
};

function severityFromScore(score: number): Severity {
  if (score < 45) return "prominent";
  if (score < 60) return "moderate";
  if (score < 75) return "mild";
  return "none";
}

async function getAccessToken(): Promise<string> {
  const apiKey = process.env.PERFECTCORP_API_KEY;
  if (!apiKey) throw new Error("PERFECTCORP_API_KEY is not set.");

  const secret = process.env.PERFECTCORP_SECRET_KEY;
  // Newer PC consoles issue a single API key used directly as the bearer
  // credential; the classic S2S scheme exchanges an RSA-encrypted id_token.
  if (!secret) return apiKey;

  const pem = secret.includes("BEGIN")
    ? secret
    : `-----BEGIN PUBLIC KEY-----\n${secret}\n-----END PUBLIC KEY-----`;
  const idToken = crypto
    .publicEncrypt(
      { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(`client_id=${apiKey}&timestamp=${Date.now()}`),
    )
    .toString("base64");

  const res = await fetch(`${BASE}/s2s/v1.0/client/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: apiKey, id_token: idToken }),
  });
  if (!res.ok) throw new Error(`Perfect Corp auth failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const token = json?.result?.access_token ?? json?.access_token;
  if (!token) throw new Error("Perfect Corp auth: no access_token in response.");
  return token;
}

export async function analyzePhotoPerfectCorp(image: {
  data: string;
  mediaType: string;
}): Promise<PhotoAnalysis> {
  const token = await getAccessToken();
  const auth = { Authorization: `Bearer ${token}` };
  const bytes = Buffer.from(image.data, "base64");

  // 1. Request an upload slot.
  const fileRes = await fetch(`${BASE}/s2s/v1.0/file/skin-analysis`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ content_type: image.mediaType, file_name: "selfie.jpg", file_size: bytes.length }],
    }),
  });
  if (!fileRes.ok) throw new Error(`PC file API failed (${fileRes.status}): ${await fileRes.text()}`);
  const fileJson = await fileRes.json();
  const fileInfo = fileJson?.result?.files?.[0];
  const uploadReq = fileInfo?.requests?.[0];
  if (!fileInfo?.file_id || !uploadReq?.url) {
    throw new Error("PC file API: unexpected response shape.");
  }

  // 2. Upload the image bytes to the presigned URL.
  const putRes = await fetch(uploadReq.url, {
    method: uploadReq.method ?? "PUT",
    headers: uploadReq.headers ?? { "Content-Type": image.mediaType },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`PC upload failed (${putRes.status})`);

  // 3. Create the analysis task.
  const taskRes = await fetch(`${BASE}/s2s/v1.0/task/skin-analysis`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      request_id: 0,
      payload: {
        file_sets: { src_ids: [fileInfo.file_id] },
        actions: [{ id: 0, params: { dst_actions: Object.keys(PC_METRIC_TO_CONCERN) } }],
      },
    }),
  });
  if (!taskRes.ok) throw new Error(`PC task API failed (${taskRes.status}): ${await taskRes.text()}`);
  const taskId = (await taskRes.json())?.result?.task_id;
  if (!taskId) throw new Error("PC task API: no task_id in response.");

  // 4. Poll for completion.
  let result: Record<string, { ui_score?: number; score?: number }> | undefined;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`${BASE}/s2s/v1.0/task/skin-analysis?task_id=${taskId}`, {
      headers: auth,
    });
    const json = await poll.json();
    const status = json?.result?.status;
    if (status === "success") {
      result = json?.result?.results ?? json?.result?.scores;
      break;
    }
    if (status === "error" || status === "failed") {
      throw new Error(`PC task failed: ${JSON.stringify(json?.result)}`);
    }
  }
  if (!result) throw new Error("PC task timed out.");

  // 5. Map PC metrics into our analysis shape.
  const scores = Object.fromEntries(CONCERN_IDS.map((id) => [id, 80])) as PhotoAnalysis["scores"];
  const findings: PhotoAnalysis["findings"] = [];

  for (const [metric, concern] of Object.entries(PC_METRIC_TO_CONCERN)) {
    const raw = result[metric];
    if (!raw) continue;
    const score = Math.round(raw.ui_score ?? raw.score ?? 80);
    scores[concern] = score;
    const severity = severityFromScore(score);
    if (severity !== "none") {
      findings.push({ id: concern, severity, note: `${CONCERN_LABELS[concern]} score: ${score}/100.` });
    }
  }
  // PC has no direct uneven-tone metric; approximate from spots + radiance.
  scores["uneven-tone"] = Math.round((scores["dark-spots"] + scores.dullness) / 2);

  const ranked = [...findings].sort(
    (a, b) => scores[a.id] - scores[b.id],
  );
  const best = (Object.entries(scores) as [ConcernId, number][]).sort((a, b) => b[1] - a[1])[0];
  const summary =
    ranked.length > 0
      ? `Your ${CONCERN_LABELS[best[0]]} is in great shape. The biggest opportunity right now is ${CONCERN_LABELS[ranked[0].id]} — the routine below is built around it.`
      : `Your skin is in great overall condition — the routine below focuses on protecting and maintaining it.`;

  return {
    isFace: true,
    imageQuality: { ok: true, issues: [] },
    skinTone: undefined, // PC skin analysis doesn't return tone; Claude provider does.
    findings: ranked,
    scores,
    summary,
  };
}
