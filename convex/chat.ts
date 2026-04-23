import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { CLAUDE_MODEL, getClient, extractText, classifyError } from "./ai/claude";

const CHAT_MAX_MSG_LEN = 2000;

export const getChatHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .order("asc")
      .take(100);
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

export const clearHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const msgs = await ctx.db
      .query("chatMessages")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .collect();
    for (const msg of msgs) await ctx.db.delete(msg._id);
  },
});

export const chatWithCoach = action({
  args: { message: v.string() },
  handler: async (ctx, { message }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const trimmed = message.trim();
    if (trimmed.length === 0) throw new Error("Please type a message.");
    if (trimmed.length > CHAT_MAX_MSG_LEN) throw new Error(`Message too long (max ${CHAT_MAX_MSG_LEN} characters).`);

    const [profile, todayLogs, history] = await Promise.all([
      ctx.runQuery(api.users.getProfile),
      ctx.runQuery(api.meals.getTodayLogs, { date: new Date().toISOString().split("T")[0] }),
      ctx.runQuery(api.chat.getChatHistory),
    ]);

    const totalCal: number = todayLogs.reduce((acc: number, l: { totalCal: number }) => acc + l.totalCal, 0);
    const calorieGoal: number = profile?.calorieGoal ?? 1800;
    const remaining = calorieGoal - totalCal;

    const mealSummary: string = todayLogs.length > 0
      ? todayLogs.map((l: { mealType: string; totalCal: number; items: { name: string }[] }) =>
          `${l.mealType}: ${l.items.map((i) => i.name).join(", ")} (${l.totalCal} cal)`
        ).join("\n")
      : "No meals logged yet today.";

    const systemPrompt = `You are Thalify, a warm and knowledgeable personal nutrition coach specializing in Indian food and wellness.

## User Profile
- Health Goal: ${profile?.goal ?? "maintain"} weight
- Diet Type: ${profile?.dietType ?? "vegetarian"}
- City: ${profile?.city ?? "India"}
- Food Dislikes: ${profile?.dislikes?.join(", ") || "none mentioned"}

## Today's Food Log (${new Date().toLocaleDateString("en-IN")})
${mealSummary}
Calories: ${totalCal} consumed / ${calorieGoal} goal (${remaining > 0 ? remaining + " remaining" : Math.abs(remaining) + " over"})

## Your Coaching Style
- Warm, encouraging, never judgmental
- Brief by default (3-4 sentences) unless they ask for more detail
- Use Indian food names and portion terms naturally (katori, roti, sabzi, etc.)
- Reference their actual food log when relevant
- Celebrate small wins
- Respond in the same language the user writes in (Hindi/English/Hinglish all fine)
- Never prescribe medication or diagnose medical conditions
- If asked about lab values, medications, or medical symptoms: "Please consult your doctor for this — I can only advise on nutrition."
- For diabetes/heart conditions: extra caution, always recommend doctor consultation
- You have deep knowledge of regional Indian cuisines, festivals, and seasonal eating patterns`;

    await ctx.runMutation(api.chat.saveMessage, { from: "user", text: trimmed });

    const recentHistory = (history as { from: string; text: string }[]).slice(-20);
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of recentHistory) {
      messages.push({
        role: msg.from === "user" ? "user" : "assistant",
        content: msg.text,
      });
    }
    messages.push({ role: "user", content: trimmed });

    let aiText: string;
    try {
      const client = getClient();
      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });
      aiText = extractText(response);
    } catch (err) {
      const classified = classifyError(err);
      throw new Error(classified.userMessage);
    }

    await ctx.runMutation(api.chat.saveMessage, { from: "ai", text: aiText });
    return aiText;
  },
});
