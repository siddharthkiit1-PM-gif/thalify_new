import { GoogleGenAI } from "@google/genai";

// gemini-2.5-flash-lite has 1000 RPD on free tier (vs gemini-flash-latest's 20).
// Still supports vision, good quality for scan + chat + family + lab + patterns.
export const GEMINI_MODEL = "gemini-2.5-flash-lite";
export const GEMINI_VISION_MODEL = "gemini-2.5-flash-lite";

export class AiError extends Error {
  readonly code: "quota" | "rate_limit" | "invalid_request" | "network" | "parse" | "unknown";
  readonly userMessage: string;
  constructor(code: AiError["code"], userMessage: string, originalMessage: string) {
    super(originalMessage);
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiError("unknown", "AI service not configured — contact support.", "GEMINI_API_KEY missing");
  }
  return new GoogleGenAI({ apiKey });
}

export function classifyError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  // Gemini 429 responses include "Please retry in Xs" in the message body.
  // Short retry (< 2 min) = per-minute throttle (recoverable quickly).
  // Long retry or no retry hint = daily/monthly quota (recover next cycle).
  const retryMatch = msg.match(/retry in\s+([\d.]+)\s*s/i);
  const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
  const isPerMinuteThrottle = retrySeconds !== null && retrySeconds < 120;

  if (lower.includes("quota") || lower.includes("resource_exhausted")) {
    if (isPerMinuteThrottle) {
      return new AiError(
        "rate_limit",
        `AI is briefly rate-limited — please retry in about ${retrySeconds} second${retrySeconds === 1 ? "" : "s"}.`,
        msg,
      );
    }
    return new AiError(
      "quota",
      "AI daily limit reached for today. Resets at midnight Pacific time.",
      msg,
    );
  }
  if (lower.includes("429") || (lower.includes("rate") && lower.includes("limit"))) {
    return new AiError("rate_limit", "Too many requests — please retry in a moment.", msg);
  }
  if (lower.includes("503") || lower.includes("high demand") || lower.includes("overloaded")) {
    return new AiError("rate_limit", "AI service is busy — please retry in a moment.", msg);
  }
  if (lower.includes("400") || lower.includes("invalid")) {
    return new AiError("invalid_request", "AI request was invalid. Please try a different input.", msg);
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout") || lower.includes("econnrefused")) {
    return new AiError("network", "Couldn't reach AI service — please retry.", msg);
  }
  return new AiError("unknown", "AI request failed — please retry. " + msg, msg);
}

export function extractJson<T>(raw: string): T {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()) as T; } catch { /* fall through */ }
  }
  const objMatch = raw.match(/\{[\s\S]*\}/);
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  const candidate = (arrMatch && objMatch
    ? (arrMatch[0].length > objMatch[0].length ? arrMatch[0] : objMatch[0])
    : (arrMatch?.[0] ?? objMatch?.[0])) ?? raw.trim();
  try {
    return JSON.parse(candidate) as T;
  } catch (e) {
    throw new AiError("parse", "AI returned malformed data — please retry.", e instanceof Error ? e.message : String(e));
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateText(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const client = getAiClient();
  const parts = opts.messages.map(m => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));
  const doCall = () => client.models.generateContent({
    model: opts.model ?? GEMINI_MODEL,
    contents: parts,
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens ?? 1024,
    },
  });
  try {
    let response;
    try {
      response = await doCall();
    } catch (firstErr) {
      // Auto-retry once for brief per-minute throttles. User never sees the error.
      const classified = classifyError(firstErr);
      if (classified.code === "rate_limit") {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        const retryMatch = msg.match(/retry in\s+([\d.]+)\s*s/i);
        const waitMs = retryMatch ? Math.min(Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500, 8000) : 2000;
        await sleep(waitMs);
        response = await doCall();
      } else {
        throw firstErr;
      }
    }
    const text = response.text;
    if (!text) {
      throw new AiError("parse", "AI returned empty response.", "empty text");
    }
    return text;
  } catch (err) {
    throw classifyError(err);
  }
}

export async function generateFromImage(opts: {
  system: string;
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  userPrompt: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const client = getAiClient();
  const doCall = () => client.models.generateContent({
    model: opts.model ?? GEMINI_VISION_MODEL,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: opts.mediaType, data: opts.imageBase64 } },
        { text: opts.userPrompt },
      ],
    }],
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  });
  try {
    let response;
    try {
      response = await doCall();
    } catch (firstErr) {
      const classified = classifyError(firstErr);
      if (classified.code === "rate_limit") {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        const retryMatch = msg.match(/retry in\s+([\d.]+)\s*s/i);
        const waitMs = retryMatch ? Math.min(Math.ceil(parseFloat(retryMatch[1]) * 1000) + 500, 8000) : 2000;
        await sleep(waitMs);
        response = await doCall();
      } else {
        throw firstErr;
      }
    }
    const text = response.text;
    if (!text) {
      throw new AiError("parse", "AI returned empty response.", "empty text");
    }
    return text;
  } catch (err) {
    throw classifyError(err);
  }
}
