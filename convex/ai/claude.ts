import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-opus-4-7";

export class ClaudeError extends Error {
  readonly code: "credits" | "rate_limit" | "invalid_request" | "network" | "parse" | "unknown";
  readonly userMessage: string;
  constructor(code: ClaudeError["code"], userMessage: string, originalMessage: string) {
    super(originalMessage);
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ClaudeError("unknown", "AI service not configured — contact support.", "ANTHROPIC_API_KEY missing");
  }
  return new Anthropic({ apiKey });
}

export function classifyError(err: unknown): ClaudeError {
  if (err instanceof ClaudeError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("credit balance") || lower.includes("credits")) {
    return new ClaudeError("credits", "AI credits exhausted — admin needs to top up Anthropic balance at console.anthropic.com", msg);
  }
  if (lower.includes("rate") && lower.includes("limit")) {
    return new ClaudeError("rate_limit", "Too many requests right now — please retry in a moment.", msg);
  }
  if (lower.includes("invalid") && lower.includes("model")) {
    return new ClaudeError("invalid_request", "AI model unavailable — contact support.", msg);
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return new ClaudeError("network", "Couldn't reach AI service — please retry.", msg);
  }
  return new ClaudeError("unknown", "AI request failed — please retry. " + msg, msg);
}

export function extractText(response: Anthropic.Message): string {
  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new ClaudeError("parse", "AI returned unexpected response format.", "No text block");
  }
  return block.text;
}

export function extractJson<T>(raw: string): T {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()) as T; } catch { /* fall through */ }
  }
  const objMatch = raw.match(/\{[\s\S]*\}/);
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  const candidate = (arrMatch && objMatch ? (arrMatch[0].length > objMatch[0].length ? arrMatch[0] : objMatch[0]) : (arrMatch?.[0] ?? objMatch?.[0])) ?? raw.trim();
  try {
    return JSON.parse(candidate) as T;
  } catch (e) {
    throw new ClaudeError("parse", "AI returned malformed data — please retry.", e instanceof Error ? e.message : String(e));
  }
}
