import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { CLAUDE_MODEL, getClient, extractText, extractJson, classifyError, ClaudeError } from "./ai/claude";

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
- If a dish is truly unidentifiable: {"name": "Unidentified item", "portion": "1 serving", "cal": 150, "protein": 5, "carbs": 20, "fat": 5}
- Return ONLY the JSON array. Zero other text.`;

type MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
type ScanItem = { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number };

async function callClaude(imageBase64: string, mediaType: MediaType): Promise<ScanItem[]> {
  const client = getClient();
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SCAN_SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: "Analyze this Indian meal photo and return the JSON array of every dish you can see." }
      ]
    }],
  });
  const raw = extractText(msg);
  const items = extractJson<ScanItem[]>(raw);
  if (!Array.isArray(items)) {
    throw new ClaudeError("parse", "AI returned non-array response — please retry.", "Not an array");
  }
  return items;
}

function validateItem(item: unknown): item is ScanItem {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return typeof o.name === "string"
    && typeof o.portion === "string"
    && typeof o.cal === "number" && o.cal >= 0
    && typeof o.protein === "number" && o.protein >= 0
    && typeof o.carbs === "number" && o.carbs >= 0
    && typeof o.fat === "number" && o.fat >= 0;
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
    if (imageBase64.length < 100) throw new Error("Image data invalid — please retry.");
    if (imageBase64.length > 10 * 1024 * 1024) throw new Error("Image too large — please use a smaller file (under 7MB).");

    let items: ScanItem[];
    try {
      items = await callClaude(imageBase64, mediaType);
    } catch (err) {
      const first = classifyError(err);
      if (first.code === "parse") {
        try {
          items = await callClaude(imageBase64, mediaType);
        } catch (err2) {
          throw new Error(classifyError(err2).userMessage);
        }
      } else {
        throw new Error(first.userMessage);
      }
    }

    const cleaned = items.filter(validateItem);
    if (cleaned.length === 0) {
      throw new Error("No food detected — try better lighting or a closer shot.");
    }

    const totalCal = cleaned.reduce((sum, i) => sum + i.cal, 0);
    const totalProtein = cleaned.reduce((sum, i) => sum + i.protein, 0);

    await ctx.runMutation(api.scan.saveScanResult, {
      userId,
      items: cleaned,
      totalCal,
      totalProtein,
      confidence: 0.92,
    });

    return { items: cleaned, totalCal, totalProtein };
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
