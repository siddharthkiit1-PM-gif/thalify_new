import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

const SCAN_SYSTEM = `You are a world-class nutrition expert specializing in Indian cuisine with deep knowledge of regional Indian dishes across all 28 states.

Analyze this meal photo carefully. Return ONLY a valid JSON array — no markdown, no code fences, no explanation.

Each item must follow this exact shape:
{"name": "Rajma", "portion": "1 katori", "cal": 180, "protein": 12, "carbs": 24, "fat": 4}

Rules:
- Identify every visible dish, condiment, and drink separately
- Use authentic Indian portion terms: katori (150ml bowl), plate, roti/chapati (per piece), cup (240ml), piece, bowl, glass
- Recognize regional names: poha/aval, uttapam, pesarattu, bisi bele bath, appam, puttu, litti chokha, dal baati churma, thepla, dhokla, etc.
- For thali: list each component separately (dal, sabzi, roti, rice, raita, papad, achaar)
- Estimate calories conservatively for accuracy; use standard Indian home-cooking portions
- Account for cooking method: ghee-fried vs steamed vs raw changes calories significantly
- If a dish is unidentifiable: {"name": "Unidentified item", "portion": "1 serving", "cal": 150, "protein": 5, "carbs": 20, "fat": 5}
- Return ONLY the JSON array. Zero other text.`;

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];
  return raw.trim();
}

async function callClaude(imageBase64: string, mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: "Analyze this Indian meal photo and return the JSON array of every dish and component you can see." }
      ]
    }],
    system: SCAN_SYSTEM,
  });
  return (msg.content[0] as { type: string; text: string }).text;
}

export const scanMeal = action({
  args: {
    imageBase64: v.string(),
    mediaType: v.optional(v.union(
      v.literal("image/jpeg"),
      v.literal("image/png"),
      v.literal("image/webp"),
      v.literal("image/gif"),
    )),
  },
  handler: async (ctx, { imageBase64, mediaType = "image/jpeg" }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let raw: string;
    try {
      raw = await callClaude(imageBase64, mediaType);
    } catch {
      throw new Error("Claude API error — please retry");
    }

    let items: { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number }[];
    try {
      items = JSON.parse(extractJson(raw));
    } catch {
      try {
        raw = await callClaude(imageBase64, mediaType);
        items = JSON.parse(extractJson(raw));
      } catch {
        throw new Error("Couldn't parse meal — try better lighting or a closer shot");
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No food items detected — try a clearer photo");
    }

    const totalCal = items.reduce((acc, i) => acc + (i.cal ?? 0), 0);
    const totalProtein = items.reduce((acc, i) => acc + (i.protein ?? 0), 0);

    await ctx.runMutation(api.scan.saveScanResult, {
      userId,
      items,
      totalCal,
      totalProtein,
      confidence: 0.92,
    });

    return { items, totalCal, totalProtein };
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
    totalProtein: v.optional(v.number()),
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
