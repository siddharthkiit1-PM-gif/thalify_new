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
  // Rich per-meal context — used by the post-meal-insight prompt
  mealItems?: string[];
  mealCal?: number;
  totalCalToday?: number;
  dietType?: string;
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

// Specialized prompt for the per-meal "buddy insight" nudge. Uses the full
// meal context (items, cal, day's totals, goal, diet) to produce a
// concrete next-step suggestion in Indian-food vocabulary. Output is a
// 1-2 line message, sent via the same Telegram + in-app channels.
const POST_MEAL_INSIGHT_SYSTEM_PROMPT = `You are Health Buddy — a personal Indian nutrition coach.

A user just logged a meal. Generate a buddy insight that references what they ate AND what their next move should be — based on their goal, diet type, day's calories so far, and the gap to their target.

RULES:
1. Reference the actual food they ate (by name) — never invent dishes they didn't have.
2. Suggest one specific Indian-food next-step (e.g., "1 katori curd at lunch" or "5-min walk + glass of water"), not generic advice like "eat more protein".
3. Use their first name once, naturally, not at the start.
4. 1-2 sentences. Tight.
5. Vocabulary: katori, roti, dal, paneer, sabzi, chai, idli, sambar, paratha, khichdi, sprouts, curd, biryani, etc.
6. If they're under target, encourage a balanced next meal. If close to target, suggest a light next move. If over, a recovery move.
7. NO fluff: "Great choice!", "I understand", "As your coach", "Remember to...". Skip the warm-up.
8. NEVER prescribe medication or mention lab values.
9. Output ONLY the message text. No quotes, no preamble, no markdown.`;

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
  const isPostMealInsight = ctx.trigger === "post-meal-insight";

  // Build the user-prompt body. Post-meal-insight uses a richer context
  // block so the AI can ground its suggestion in macros + diet + the
  // actual items the user ate.
  const userPrompt = isPostMealInsight
    ? `User just logged a meal.
- Name: ${ctx.name}
- Goal: ${ctx.goal}${ctx.dietType ? ` · diet: ${ctx.dietType}` : ""}
${ctx.calorieGoal ? `- Daily target: ${ctx.calorieGoal} kcal` : ""}
${ctx.totalCalToday !== undefined ? `- Total today including this meal: ${ctx.totalCalToday} kcal` : ""}
${ctx.calorieGoal && ctx.totalCalToday !== undefined ? `- Remaining: ${ctx.calorieGoal - ctx.totalCalToday} kcal` : ""}
${ctx.weightKg ? `- Weight: ${ctx.weightKg} kg` : ""}
${ctx.mealItems && ctx.mealItems.length > 0 ? `- Just ate: ${ctx.mealItems.join(", ")}` : ctx.lastMealName ? `- Just ate: ${ctx.lastMealName}` : ""}
${ctx.mealCal !== undefined ? `- This meal: ${ctx.mealCal} kcal` : ""}

Template hint (use the tone/intent, but rewrite based on real context above):
"${ctx.template}"

Output: just the buddy-insight message — 1 to 2 lines, specific and Indian-food native.`
    : `Rewrite this template:
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
      system: isPostMealInsight ? POST_MEAL_INSIGHT_SYSTEM_PROMPT : SYSTEM_PROMPT,
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
