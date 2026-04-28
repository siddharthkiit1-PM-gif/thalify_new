import { generateText, classifyError } from "../ai/claude";
import type { SignalPrediction } from "./signal";

export type WriterContext = {
  name: string;
  goal: string;
  trigger: string;
  template: string;
  signal: SignalPrediction | null;
  lastMealName?: string;
  food?: string;
  weightKg?: number;
  calorieGoal?: number;
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

/**
 * Used only when the AI rewriter fails (Gemini throttle, quota, network).
 * Substitutes {name} with the user's first name. For any *other* unfilled
 * placeholder ({avgCal}, {totalCal}, {recapNote}, etc.), strip the
 * surrounding awkwardness so the user never sees raw braces.
 *
 *   "Average day was {avgCal} cal. Tomorrow's a fresh sheet."
 *     → with raw replace would be: "Average day was {avgCal} cal..."
 *     → we strip to: "Tomorrow's a fresh sheet."
 *
 * Sentences containing an unfilled placeholder get dropped entirely
 * (cleaner than leaving "Average day was cal" half-readable).
 */
function fallback(
  template: string,
  name: string,
  extras: { food?: string; weightKg?: number; calorieGoal?: number } = {},
): string {
  // 1. substitute known placeholders
  let text = template.replace(/\{name\}/g, name);
  if (extras.food) text = text.replace(/\{food\}/g, extras.food);
  if (extras.weightKg !== undefined)
    text = text.replace(/\{weightKg\}/g, String(extras.weightKg));
  if (extras.calorieGoal !== undefined)
    text = text.replace(/\{calorieGoal\}/g, String(extras.calorieGoal));
  // 2. drop any sentence that still has an unfilled {placeholder}
  if (/\{[a-zA-Z]\w*\}/.test(text)) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const clean = sentences.filter((s) => !/\{[a-zA-Z]\w*\}/.test(s));
    text = clean.join(" ").trim();
  }
  // 3. if everything got dropped, return a safe minimal nudge
  if (text.length < 8) {
    return `Quick check-in, ${name}. Open Thalify to see today's progress.`;
  }
  return text;
}

export async function writeNudge(ctx: WriterContext): Promise<WriterResult> {
  const userPrompt = `Rewrite this template:
"${ctx.template}"

Context:
- Name: ${ctx.name}
- Goal: ${ctx.goal}
- Trigger: ${ctx.trigger}
${ctx.weightKg ? `- Current weight: ${ctx.weightKg} kg` : ""}
${ctx.calorieGoal ? `- Daily calorie goal: ${ctx.calorieGoal} kcal` : ""}
${ctx.lastMealName ? `- Last meal: ${ctx.lastMealName}` : ""}
${ctx.food ? `- Repeated food: ${ctx.food}` : ""}
${ctx.signal ? `- Predicted impact: ${ctx.signal.context}, ~${ctx.signal.kg30Days.toFixed(1)} kg over 30 days` : ""}

Output: just the rewritten line.`;

  const extras = {
    food: ctx.food,
    weightKg: ctx.weightKg,
    calorieGoal: ctx.calorieGoal,
  };

  try {
    const text = await generateText({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 150,
    });
    const cleaned = text.trim().replace(/^["']|["']$/g, "");
    if (!cleaned) {
      return { message: fallback(ctx.template, ctx.name, extras), aiFallback: true };
    }
    return { message: cleaned, aiFallback: false };
  } catch (err) {
    const classified = classifyError(err);
    if (
      classified.code === "rate_limit" ||
      classified.code === "quota" ||
      classified.code === "network"
    ) {
      return { message: fallback(ctx.template, ctx.name, extras), aiFallback: true };
    }
    throw err;
  }
}
