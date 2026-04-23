import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

export const getChatHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .order("asc")
      .take(50);
  },
});

export const saveMessage = mutation({
  args: {
    from: v.union(v.literal("user"), v.literal("ai")),
    text: v.string(),
  },
  handler: async (ctx, { from, text }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.insert("chatMessages", { userId, from, text, createdAt: Date.now() });
  },
});

export const chatWithCoach = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [profile, todayLogs] = await Promise.all([
      ctx.runQuery(api.users.getProfile),
      ctx.runQuery(api.meals.getTodayLogs, { date: new Date().toISOString().split("T")[0] }),
    ]);

    const totalCal = todayLogs.reduce((acc: number, l: any) => acc + l.totalCal, 0);
    const mealSummary = todayLogs.length > 0
      ? todayLogs.map((l: any) => `${l.mealType}: ${l.items.map((i: any) => i.name).join(", ")} (${l.totalCal} cal)`).join("\n")
      : "No meals logged yet today.";

    const systemPrompt = `You are a personal nutrition coach specializing in Indian food.

User profile:
- Goal: ${profile?.goal ?? "maintain"}
- Diet: ${profile?.dietType ?? "veg"}
- City: ${profile?.city ?? "bangalore"}
- Dislikes: ${profile?.dislikes?.join(", ") || "none"}

Today's food log (${new Date().toLocaleDateString("en-IN")}):
${mealSummary}
Calories consumed: ${totalCal} / ${profile?.calorieGoal ?? 1800}

Rules:
- Be warm but brief (3-4 sentences max unless asked for more)
- Use Indian food names and portion terms (katori, roti, cup)
- Respond in the same language the user writes in
- Never prescribe medication or diagnose
- If asked about lab values or medications, say "please consult your doctor"`;

    await ctx.runMutation(api.chat.saveMessage, { from: "user", text: message });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    });

    const aiText = (response.content[0] as { type: string; text: string }).text;
    await ctx.runMutation(api.chat.saveMessage, { from: "ai", text: aiText });

    return aiText;
  },
});
