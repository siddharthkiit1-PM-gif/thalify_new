import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

const SCAN_SYSTEM = `You are a nutrition expert specializing in Indian cuisine.
Analyze this meal photo. Return ONLY a JSON array with this exact shape:
[{"name": "Rajma", "portion": "1 katori", "cal": 180, "protein": 12, "carbs": 24, "fat": 4}]
Rules:
- Use Indian portion terms: katori, plate, roti, cup, piece, bowl
- Handle regional names: poha=aval, uttapam, pesarattu, bisi bele bath, etc.
- Estimate conservatively for weight-loss goals
- If you cannot identify a dish: {"name": "Unidentified item", "portion": "1 serving", "cal": 150, "protein": 5, "carbs": 20, "fat": 5}
- Return ONLY the JSON array. No markdown. No explanation.`;

async function callClaude(imageBase64: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
        { type: "text", text: "Analyze this meal and return the JSON array." }
      ]
    }],
    system: SCAN_SYSTEM,
  });
  return (msg.content[0] as { type: string; text: string }).text;
}

export const scanMeal = action({
  args: { imageBase64: v.string() },
  handler: async (ctx, { imageBase64 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let raw: string;
    try {
      raw = await callClaude(imageBase64);
    } catch {
      throw new Error("Claude API error — please retry");
    }

    let items: { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number }[];
    try {
      items = JSON.parse(raw);
    } catch {
      try {
        raw = await callClaude(imageBase64);
        items = JSON.parse(raw);
      } catch {
        throw new Error("Couldn't parse meal — try better lighting or a closer shot");
      }
    }

    const totalCal = items.reduce((acc, i) => acc + i.cal, 0);

    await ctx.runMutation(api.scan.saveScanResult, {
      userId,
      items,
      totalCal,
      confidence: 0.85,
    });

    return { items, totalCal };
  },
});

export const saveScanResult = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(v.object({
      name: v.string(), portion: v.string(),
      cal: v.number(), protein: v.number(), carbs: v.number(), fat: v.number(),
    })),
    totalCal: v.number(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("scanResults", { ...args, createdAt: Date.now() });
    const profile = await ctx.db.query("profiles")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { scanCount: (profile.scanCount ?? 0) + 1 });
  },
});
