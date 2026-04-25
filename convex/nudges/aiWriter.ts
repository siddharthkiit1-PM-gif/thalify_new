import { generateText, classifyError } from "../ai/claude";
import type { SignalPrediction } from "./signal";

export type WriterContext = {
  name: string;
  goal: string;
  trigger: string;
  template: string;
  signal: SignalPrediction | null;
  lastMealName?: string;
};

export type WriterResult = {
  message: string;
  aiFallback: boolean;
};

const SYSTEM_PROMPT = `You are Health Buddy — a warm, no-fluff Indian nutrition coach.

You will be given:
- A template line that captures the intent of the nudge
- The user's name, goal, and (sometimes) a kg-impact prediction

Your job: rewrite the template into a personalized 1-line nudge for this user.

RULES:
1. Use the user's first name once, naturally — not at the start.
2. If a kg-impact signal is provided, weave it in naturally ("~0.8 kg by next month"), don't make it sound like math homework.
3. NO fluff phrases: "Great question!", "I understand", "As your health buddy", "It's important to..."
4. 1-2 sentences MAX. Aim for 1.
5. Indian context welcome: katori, roti, chai, dal, paneer, etc.
6. NEVER prescribe medication. NEVER mention lab values.
7. Output ONLY the message text. No quotes, no preamble, no markdown.`;

function fallback(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}

export async function writeNudge(ctx: WriterContext): Promise<WriterResult> {
  const userPrompt = `Rewrite this template:
"${ctx.template}"

Context:
- Name: ${ctx.name}
- Goal: ${ctx.goal}
- Trigger: ${ctx.trigger}
${ctx.lastMealName ? `- Last meal: ${ctx.lastMealName}` : ""}
${ctx.signal ? `- Predicted impact: ${ctx.signal.context}, ~${ctx.signal.kg30Days.toFixed(1)} kg over 30 days` : ""}

Output: just the rewritten line.`;

  try {
    const text = await generateText({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 150,
    });
    const cleaned = text.trim().replace(/^["']|["']$/g, "");
    if (!cleaned) {
      return { message: fallback(ctx.template, ctx.name), aiFallback: true };
    }
    return { message: cleaned, aiFallback: false };
  } catch (err) {
    const classified = classifyError(err);
    if (
      classified.code === "rate_limit" ||
      classified.code === "quota" ||
      classified.code === "network"
    ) {
      return { message: fallback(ctx.template, ctx.name), aiFallback: true };
    }
    throw err;
  }
}
