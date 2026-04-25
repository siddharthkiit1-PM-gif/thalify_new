import { action, mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { generateText, classifyError } from "./ai/claude";
import { checkRateLimit } from "./lib/rateLimit";
import { isUnlimitedUser } from "./lib/tiers";
import { enforceUserQuota } from "./lib/quota";

const ENFORCE_QUOTA = false;

export const enforceChatRateLimit = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const limitKey = isUnlimitedUser(user?.email ?? null) ? "chat" : "chat_free";
    await checkRateLimit(ctx, userId, limitKey);
    await enforceUserQuota(ctx, userId, "chat", { enforce: ENFORCE_QUOTA });
  },
});

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

function getISTHour(): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(hourStr, 10) % 24;
}

type TimeContext = { period: string; guidance: string };

function getTimeContext(hour: number): TimeContext {
  if (hour < 10) return {
    period: "early morning",
    guidance: "Breakfast window. If they ask about next meal, suggest breakfast. Light suggestions are appropriate.",
  };
  if (hour < 12) return {
    period: "late morning",
    guidance: "Pre-lunch. Good time for hydration, mid-morning snack, or lunch planning.",
  };
  if (hour < 15) return {
    period: "lunch time",
    guidance: "Lunch window. Suggest lunch options if relevant. Portion and composition advice works here.",
  };
  if (hour < 17) return {
    period: "afternoon",
    guidance: "Snack window. Light snacks OK. Suggest dinner planning if they ask.",
  };
  if (hour < 19) return {
    period: "early evening",
    guidance: "Pre-dinner. Dinner suggestions are welcome. They can still make choices that affect today's totals.",
  };
  if (hour < 21) return {
    period: "dinner time",
    guidance: "Dinner window. If they are planning dinner, suggest. If they already logged dinner, the day's food is essentially done — do NOT tell them to 'eat less'.",
  };
  if (hour < 23) return {
    period: "post-dinner night",
    guidance: "Dinner is likely done. NEVER tell them to 'eat lighter' or 'have a small dinner' — that ship has sailed. If they are over budget, pivot to: water, 10-15 min walk, earlier breakfast tomorrow, earlier dinner tomorrow. If they are under budget, no need to push more food — rest is fine. If they say they are hungry: only suggest water first; if still hungry, a small katori curd or buttermilk — nothing heavy.",
  };
  return {
    period: "late night",
    guidance: "Too late to eat meaningfully. Do not suggest meals. If they are hungry: water first, then only a small katori curd at most. Focus on sleep, and plan tomorrow if they ask.",
  };
}

export const chatWithCoach = action({
  args: { message: v.string() },
  handler: async (ctx, { message }): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const trimmed = message.trim();
    if (trimmed.length === 0) throw new Error("Please type a message.");
    if (trimmed.length > CHAT_MAX_MSG_LEN) throw new Error(`Message too long (max ${CHAT_MAX_MSG_LEN} characters).`);

    await ctx.runMutation(internal.chat.enforceChatRateLimit, { userId });

    const [profile, todayLogs, history, currentUser] = await Promise.all([
      ctx.runQuery(api.users.getProfile),
      ctx.runQuery(api.meals.getTodayLogs, { date: new Date().toISOString().split("T")[0] }),
      ctx.runQuery(api.chat.getChatHistory),
      ctx.runQuery(api.users.getCurrentUser),
    ]);

    const fullName = currentUser?.name ?? "";
    const firstName = fullName.trim().split(/\s+/)[0] || "there";

    const totalCal: number = todayLogs.reduce((acc: number, l: { totalCal: number }) => acc + l.totalCal, 0);
    const totalProtein: number = todayLogs.reduce((acc: number, l: { items: { protein: number }[] }) =>
      acc + l.items.reduce((a, i) => a + (i.protein ?? 0), 0), 0);
    const calorieGoal: number = profile?.calorieGoal ?? 1800;
    const remaining = calorieGoal - totalCal;
    const isOverBudget = remaining < 0;

    const hasDinnerLogged = todayLogs.some((l: { mealType: string }) => l.mealType === "dinner");
    const hasLunchLogged = todayLogs.some((l: { mealType: string }) => l.mealType === "lunch");
    const hasBreakfastLogged = todayLogs.some((l: { mealType: string }) => l.mealType === "breakfast");

    const mealSummary: string = todayLogs.length > 0
      ? todayLogs.map((l: { mealType: string; totalCal: number; items: { name: string; portion: string; protein: number }[] }) =>
          `- ${l.mealType}: ${l.items.map((i) => `${i.name} (${i.portion}, ${Math.round(i.protein)}g protein)`).join(", ")} — ${l.totalCal} cal total`
        ).join("\n")
      : "(nothing logged yet today)";

    const hour = getISTHour();
    const timeCtx = getTimeContext(hour);
    const mealStatus = [
      hasBreakfastLogged ? "breakfast ✓" : "no breakfast",
      hasLunchLogged ? "lunch ✓" : "no lunch",
      hasDinnerLogged ? "dinner ✓" : "no dinner",
    ].join(" · ");

    const systemPrompt = `You are Health Buddy — ${firstName}'s personal nutrition coach for Indian food.

━━━ ${firstName.toUpperCase()}'S CONTEXT (read this before every reply) ━━━
Name: ${firstName}
Goal: ${profile?.goal ?? "maintain"} weight
Diet: ${profile?.dietType ?? "vegetarian"}
Daily target: ${calorieGoal} cal
Food dislikes: ${profile?.dislikes?.join(", ") || "none"}
${profile?.weightKg ? `Weight: ${profile.weightKg} kg` : ""}${profile?.age ? ` · Age: ${profile.age}` : ""}${profile?.activityLevel ? ` · Activity: ${profile.activityLevel}` : ""}

━━━ TODAY'S FOOD LOG ━━━
Meals logged: ${mealStatus}
${mealSummary}

Running totals: ${totalCal} / ${calorieGoal} cal · ${Math.round(totalProtein)}g protein
Budget: ${isOverBudget ? `${Math.abs(remaining)} OVER` : `${remaining} remaining`}

━━━ CURRENT TIME ━━━
${hour}:00 IST · ${timeCtx.period}
${timeCtx.guidance}

━━━ HARD RULES ━━━
1. START by reading the food log above. Every answer must reference what ${firstName} actually ate. If the log is empty and they ask about today, tell them there's nothing logged — don't make things up.

2. CALL THEM BY NAME. Use "${firstName}" naturally in the reply. Not in every sentence — just once, early, like you know them.

3. TIME AWARENESS (most important):
   - If it's post-dinner night / late night (${hour >= 21 ? "WHICH IT IS RIGHT NOW" : "not currently"}): dinner is DONE. ${firstName} cannot "eat lighter" anymore. If over budget, pivot to: drink 2 glasses water, take a 10-15 min walk, set earlier dinner tomorrow, heavier breakfast tomorrow. Never say "have a small dinner" or "skip snacks" — meals are finished for the day.
   - If it's dinner time but dinner is already logged${hasDinnerLogged ? " (it is logged)" : ""}: same as above — don't suggest eating less, work with tomorrow.
   - Otherwise: time-appropriate suggestions are fine.

4. NO FLUFF. Banned phrases: "Great question!", "I understand", "Based on your data", "As your health buddy", "It's important to...", "I'm here to help". Skip the warm-up, go straight to advice.

5. BE SPECIFIC. "Eat more protein" is garbage. Good: "Add 1 boiled egg + 1 katori curd at breakfast — gets you to 80g protein easily." Use Indian portion terms: katori, roti, glass, plate, piece.

6. 2-4 SENTENCES usually. Longer only if they explicitly ask for detail.

7. MATCH THEIR LANGUAGE. If they write in Hindi or Hinglish, reply the same way.

━━━ SAFETY ━━━
- Never prescribe medication or diagnose
- Lab values / symptoms / medications: "check with your doctor — I can only advise on nutrition"
- Diabetes / heart patients: extra caution, always recommend doctor consult

━━━ GOOD vs BAD EXAMPLE ━━━
User at 10 PM, 200 cal over budget, asks "I'm hungry, what should I eat?"

BAD: "I understand you're feeling hungry! Based on your data, you're 200 calories over your goal today. I'd recommend a light snack like cucumber slices or a small portion of salad to stay on track."
(why bad: fluff opening, generic suggestion, ignores that dinner is done and eating more is wrong advice)

GOOD: "You're done eating today, ${firstName} — 200 over already. Drink 2 glasses of water and take a 10-minute walk, that kills the craving. If it's real hunger, half katori curd. Tomorrow, push breakfast heavier so you don't end up here again."
(why good: uses name once, acknowledges dinner is done, actionable for now, plans tomorrow, specific portions)

Now answer ${firstName}'s question using everything above.`;

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
      aiText = await generateText({
        system: systemPrompt,
        messages,
        maxTokens: 1024,
      });
    } catch (err) {
      throw new Error(classifyError(err).userMessage, { cause: err });
    }

    await ctx.runMutation(api.chat.saveMessage, { from: "ai", text: aiText });
    return aiText;
  },
});

// ─── Internal-callable chat (used by Telegram webhook) ──────────────────

export const getHistoryForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .order("asc")
      .take(100);
  },
});

export const saveMessageForUser = internalMutation({
  args: {
    userId: v.id("users"),
    from: v.union(v.literal("user"), v.literal("ai")),
    text: v.string(),
  },
  handler: async (ctx, { userId, from, text }) => {
    await ctx.db.insert("chatMessages", { userId, from, text, createdAt: Date.now() });
  },
});

/**
 * Identical AI behaviour to `chatWithCoach` but invoked with an explicit
 * userId — used by the Telegram webhook where there's no auth context.
 * Reads the same context (profile, today's meals, history) and shares the
 * same system prompt.
 */
export const chatAsUser = internalAction({
  args: { userId: v.id("users"), message: v.string() },
  handler: async (ctx, { userId, message }): Promise<string> => {
    const trimmed = message.trim();
    if (trimmed.length === 0) throw new Error("Empty message");
    if (trimmed.length > CHAT_MAX_MSG_LEN) {
      throw new Error(`Message too long (max ${CHAT_MAX_MSG_LEN} characters).`);
    }

    await ctx.runMutation(internal.chat.enforceChatRateLimit, { userId });

    type Profile = { goal?: string; dietType?: string; calorieGoal?: number; dislikes?: string[]; weightKg?: number; age?: number; activityLevel?: string };
    type MealLog = { mealType: string; totalCal: number; items: { name: string; portion: string; protein: number }[] };
    type ChatMsg = { from: string; text: string };
    type UserDoc = { name: string | null };

    const today = new Date().toISOString().split("T")[0];
    const [profile, todayLogs, history, currentUser] = await Promise.all([
      ctx.runQuery(internal.users.getProfileForUser, { userId }) as Promise<Profile | null>,
      ctx.runQuery(internal.meals.getTodayLogsForUser, { userId, date: today }) as Promise<MealLog[]>,
      ctx.runQuery(internal.chat.getHistoryForUser, { userId }) as Promise<ChatMsg[]>,
      ctx.runQuery(internal.users.getUserByIdInternal, { userId }) as Promise<UserDoc | null>,
    ]);

    const fullName = currentUser?.name ?? "";
    const firstName = fullName.trim().split(/\s+/)[0] || "there";
    const totalCal = todayLogs.reduce((acc, l) => acc + l.totalCal, 0);
    const totalProtein = todayLogs.reduce(
      (acc, l) => acc + l.items.reduce((a, i) => a + (i.protein ?? 0), 0),
      0,
    );
    const calorieGoal = profile?.calorieGoal ?? 1800;
    const remaining = calorieGoal - totalCal;
    const isOverBudget = remaining < 0;
    const hasBreakfast = todayLogs.some((l) => l.mealType === "breakfast");
    const hasLunch = todayLogs.some((l) => l.mealType === "lunch");
    const hasDinner = todayLogs.some((l) => l.mealType === "dinner");
    const mealSummary = todayLogs.length > 0
      ? todayLogs.map((l) =>
          `- ${l.mealType}: ${l.items.map((i) => `${i.name} (${i.portion}, ${Math.round(i.protein)}g protein)`).join(", ")} — ${l.totalCal} cal total`
        ).join("\n")
      : "(nothing logged yet today)";
    const hour = getISTHour();
    const timeCtx = getTimeContext(hour);
    const mealStatus = [
      hasBreakfast ? "breakfast ✓" : "no breakfast",
      hasLunch ? "lunch ✓" : "no lunch",
      hasDinner ? "dinner ✓" : "no dinner",
    ].join(" · ");

    const systemPrompt = `You are Health Buddy — ${firstName}'s personal nutrition coach for Indian food, replying over Telegram.

━━━ ${firstName.toUpperCase()}'S CONTEXT ━━━
Goal: ${profile?.goal ?? "maintain"} weight · Diet: ${profile?.dietType ?? "vegetarian"}
Daily target: ${calorieGoal} cal · Dislikes: ${profile?.dislikes?.join(", ") || "none"}

━━━ TODAY'S FOOD LOG ━━━
Meals: ${mealStatus}
${mealSummary}
Totals: ${totalCal} / ${calorieGoal} cal · ${Math.round(totalProtein)}g protein
Budget: ${isOverBudget ? `${Math.abs(remaining)} OVER` : `${remaining} remaining`}

━━━ TIME ━━━
${hour}:00 IST · ${timeCtx.period}
${timeCtx.guidance}

━━━ TELEGRAM RULES ━━━
1. Reference what they actually ate — never invent meals. If log is empty, say so.
2. Use ${firstName}'s name once, naturally, not at the start.
3. NO fluff: "Great question!", "I understand", "As your coach", "It's important to...". Skip warm-up.
4. Be SPECIFIC. "Eat more protein" is garbage. "Add 1 boiled egg + 1 katori curd" is good. Use Indian portion words: katori, roti, glass, plate, piece.
5. 1-3 SENTENCES. Telegram messages are read at a glance. Longer only if explicitly asked.
6. Match their language: Hindi/Hinglish in → reply in same.
7. NEVER prescribe medication, diagnose, or comment on lab values. Defer to "check with your doctor".`;

    await ctx.runMutation(internal.chat.saveMessageForUser, { userId, from: "user", text: trimmed });

    const recent = history.slice(-20);
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of recent) {
      messages.push({ role: m.from === "user" ? "user" : "assistant", content: m.text });
    }
    messages.push({ role: "user", content: trimmed });

    let aiText: string;
    try {
      aiText = await generateText({ system: systemPrompt, messages, maxTokens: 600 });
    } catch (err) {
      throw new Error(classifyError(err).userMessage, { cause: err });
    }

    await ctx.runMutation(internal.chat.saveMessageForUser, { userId, from: "ai", text: aiText });
    return aiText;
  },
});
