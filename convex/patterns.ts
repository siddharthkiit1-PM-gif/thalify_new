import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { CLAUDE_MODEL, getClient, extractText, extractJson, classifyError } from "./ai/claude";

type PatternResult = {
  topPatterns: string[];
  wins: string[];
  improvements: string[];
  weeklyInsight: string;
  streakMessage: string;
};

export const analyzePatterns = action({
  args: {},
  handler: async (ctx): Promise<PatternResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [logs, profile] = await Promise.all([
      ctx.runQuery(api.meals.getRecentLogs),
      ctx.runQuery(api.users.getProfile),
    ]);

    if (!logs || logs.length === 0) {
      return {
        topPatterns: [],
        wins: [],
        improvements: [],
        weeklyInsight: "Start logging meals to see your patterns.",
        streakMessage: "Log your first meal to begin.",
      };
    }

    const logSummary = logs.slice(0, 30).map((l: { date: string; mealType: string; totalCal: number; items: { name: string }[] }) =>
      `${l.date} ${l.mealType}: ${l.items.map(i => i.name).join(", ")} (${l.totalCal} cal)`
    ).join("\n");

    const systemPrompt = `You are a behavioral nutritionist analyzing an Indian user's meal patterns.

Return ONLY a valid JSON object with this shape:
{
  "topPatterns": ["3 behavioral observations about eating habits"],
  "wins": ["2-3 positive patterns to celebrate"],
  "improvements": ["2-3 specific, actionable improvements"],
  "weeklyInsight": "One insightful paragraph about the user's overall nutrition pattern",
  "streakMessage": "One motivating sentence about their logging consistency"
}

Base your analysis on actual food choices, meal timing, calorie patterns, and nutritional diversity.
Use Indian food knowledge — recognize if they're eating balanced meals with dal/roti/sabzi vs processed/high-calorie choices.
Be warm, specific, and actionable.
Return ONLY the JSON object.`;

    const userMessage = `User goal: ${profile?.goal ?? "maintain"}\nDiet type: ${profile?.dietType ?? "veg"}\nCalorie goal: ${profile?.calorieGoal ?? 1800}/day\n\nMeal history (last 30 days):\n${logSummary}`;

    try {
      const client = getClient();
      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      return extractJson<PatternResult>(extractText(response));
    } catch (err) {
      throw new Error(classifyError(err).userMessage);
    }
  },
});
