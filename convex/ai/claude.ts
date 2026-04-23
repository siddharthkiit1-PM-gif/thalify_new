import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-flash-latest";
export const GEMINI_VISION_MODEL = "gemini-flash-latest";

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
  if (lower.includes("quota") || lower.includes("resource_exhausted")) {
    return new AiError("quota", "AI daily quota reached — please try again tomorrow.", msg);
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
  try {
    const response = await client.models.generateContent({
      model: opts.model ?? GEMINI_MODEL,
      contents: parts,
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxTokens ?? 1024,
      },
    });
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
  try {
    const response = await client.models.generateContent({
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
    const text = response.text;
    if (!text) {
      throw new AiError("parse", "AI returned empty response.", "empty text");
    }
    return text;
  } catch (err) {
    throw classifyError(err);
  }
}
