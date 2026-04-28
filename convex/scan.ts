import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { generateFromImage, generateText, extractJson, classifyError, AiError } from "./ai/claude";
import { checkRateLimit } from "./lib/rateLimit";
import { isUnlimitedUser } from "./lib/tiers";
import { enforceUserQuota } from "./lib/quota";
import type { Id } from "./_generated/dataModel";

// Quota tracking — soft mode currently (counts but doesn't block).
// Will be flipped to enforce: true once the paywall ships.
const ENFORCE_QUOTA = false;

const SCAN_SYSTEM = `You are a world-class nutrition expert specializing in Indian cuisine with deep knowledge of regional Indian dishes across all 28 states.

Analyze this meal photo carefully. Return ONLY a valid JSON array — no markdown, no code fences, no explanation.

Each item must follow this exact shape:
{"name": "Rajma", "portion": "1 katori", "cal": 180, "protein": 12, "carbs": 24, "fat": 4}

Rules:
- Identify every visible dish, condiment, and drink separately
- Use authentic Indian portion terms: katori (150ml bowl), plate, roti/chapati (per piece), cup (240ml), piece, bowl, glass
- Recognize regional names: poha/aval, uttapam, pesarattu, bisi bele bath, appam, puttu, litti chokha, dal baati churma, thepla, dhokla
- For thali: list each component separately (dal, sabzi, roti, rice, raita, papad, achaar)
- Estimate calories conservatively for accuracy; use standard Indian home-cooking portions
- Account for cooking method: ghee-fried vs steamed vs raw changes calories significantly
- If a dish is truly unidentifiable: {"name": "Unidentified item", "portion": "1 serving", "cal": 150, "protein": 5, "carbs": 20, "fat": 5}
- Return ONLY the JSON array. Zero other text.`;

type MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
type ScanItem = { name: string; portion: string; cal: number; protein: number; carbs: number; fat: number };

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

// ─── Text → meal extractor ────────────────────────────────────────────
// Used by the Telegram bot when a user TYPES a meal description instead
// of sending a photo. Returns either:
//   { intent: "log_meal", items, totalCal, totalProtein, confidence }
//   { intent: "chat" }                              ← not a meal-log message
//
// The classifier is intentionally conservative — only past/present-tense
// reports of food eaten get treated as logs. Planning ("I'm thinking
// of having dosa"), questions, and greetings fall through to chat.

const TEXT_INTAKE_SYSTEM = `You are an Indian-food intent classifier and meal extractor for Thalify, a nutrition coach.

Given ONE user message, decide the intent:
- "log_meal" — user is reporting food they ate or are eating RIGHT NOW. Past or present tense. Examples: "I had X", "just ate Y", "khaya biryani", "having 2 rotis and dal".
- "chat" — anything else. Questions ("what should I eat?"), planning ("I'm thinking of pizza"), greetings, complaints, generic chat.

If log_meal: extract each food item with:
- name in Title Case (English or transliterated)
- portion in Indian terms when natural (katori, roti piece, glass, plate) — or use the stated quantity (200g, 1 cup)
- realistic Indian-home-cooking calorie + macro estimates per portion
- protein/carbs/fat in grams

Reply with JSON ONLY — no markdown fences, no preamble.

For log_meal:
{"intent":"log_meal","items":[{"name":"Butter Paneer","portion":"200g","cal":580,"protein":25,"carbs":8,"fat":50}],"totalCal":580,"totalProtein":25,"confidence":0.85}

For chat:
{"intent":"chat"}

Examples:
- "I had 200g butter paneer and 2 rotis" → log_meal with both items
- "khaya biryani" → log_meal, biryani 1 plate, ~550 cal
- "had a katori dal-rice for lunch" → log_meal
- "what should I eat for dinner?" → chat
- "I'm thinking of having pizza" → chat (planning, not eaten)
- "thanks" → chat`;

type TextExtractResult =
  | { intent: "log_meal"; items: ScanItem[]; totalCal: number; totalProtein: number; confidence: number }
  | { intent: "chat" };

async function extractFromText(message: string): Promise<TextExtractResult> {
  const raw = await generateText({
    system: TEXT_INTAKE_SYSTEM,
    messages: [{ role: "user", content: message }],
    maxTokens: 1024,
  });
  const parsed = extractJson<{
    intent?: string;
    items?: unknown;
    totalCal?: number;
    totalProtein?: number;
    confidence?: number;
  }>(raw);
  if (parsed.intent === "log_meal" && Array.isArray(parsed.items)) {
    const cleaned = (parsed.items as unknown[]).filter(validateItem);
    if (cleaned.length === 0) return { intent: "chat" };
    const totalCal =
      typeof parsed.totalCal === "number"
        ? parsed.totalCal
        : cleaned.reduce((s, i) => s + i.cal, 0);
    const totalProtein =
      typeof parsed.totalProtein === "number"
        ? parsed.totalProtein
        : cleaned.reduce((s, i) => s + i.protein, 0);
    const confidence =
      typeof parsed.confidence === "number" ? parsed.confidence : 0.7;
    return { intent: "log_meal", items: cleaned, totalCal, totalProtein, confidence };
  }
  return { intent: "chat" };
}

async function scan(imageBase64: string, mediaType: MediaType): Promise<ScanItem[]> {
  const raw = await generateFromImage({
    system: SCAN_SYSTEM,
    imageBase64,
    mediaType,
    userPrompt: "Analyze this Indian meal photo and return the JSON array of every dish you can see.",
    maxTokens: 2048,
  });
  const items = extractJson<ScanItem[]>(raw);
  if (!Array.isArray(items)) {
    throw new AiError("parse", "AI returned non-array response — please retry.", "Not an array");
  }
  return items;
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
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { imageBase64, mediaType = "image/jpeg", imageStorageId }): Promise<{
    scanResultId: string;
    items: ScanItem[];
    totalCal: number;
    totalProtein: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (imageBase64.length < 100) throw new Error("Image data invalid — please retry.");
    if (imageBase64.length > 10 * 1024 * 1024) throw new Error("Image too large — please use a smaller file (under 7MB).");

    await ctx.runMutation(internal.scan.enforceScanRateLimit, { userId });

    let items: ScanItem[];
    try {
      items = await scan(imageBase64, mediaType);
    } catch (err) {
      const first = classifyError(err);
      if (first.code === "parse") {
        try {
          items = await scan(imageBase64, mediaType);
        } catch (err2) {
          throw new Error(classifyError(err2).userMessage, { cause: err2 });
        }
      } else {
        throw new Error(first.userMessage, { cause: err });
      }
    }

    const cleaned = items.filter(validateItem);
    if (cleaned.length === 0) {
      throw new Error("No food detected — try better lighting or a closer shot.");
    }

    const totalCal = cleaned.reduce((sum, i) => sum + i.cal, 0);
    const totalProtein = cleaned.reduce((sum, i) => sum + i.protein, 0);

    const scanResultId: string = await ctx.runMutation(internal.scan.saveScanResultInternal, {
      userId,
      items: cleaned,
      rawItems: cleaned,
      totalCal,
      totalProtein,
      confidence: 0.9,
      imageStorageId,
    });

    await ctx.runMutation(internal.nudges.queue.enqueue, {
      userId,
      type: "scan_completed",
      payload: { totalCal, itemCount: cleaned.length },
    });

    return { scanResultId, items: cleaned, totalCal, totalProtein };
  },
});

/**
 * Internal-callable scan + auto-log used by the Telegram webhook.
 * Same Gemini scan path, but takes userId explicitly and (optionally) logs
 * the meal to the user's mealLogs in one go.
 */
export const scanMealAsUser = internalAction({
  args: {
    userId: v.id("users"),
    imageBase64: v.string(),
    mediaType: v.optional(v.union(
      v.literal("image/jpeg"),
      v.literal("image/png"),
      v.literal("image/webp"),
      v.literal("image/gif"),
    )),
    autoLogAsMealType: v.optional(v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("snack"),
      v.literal("dinner"),
    )),
  },
  handler: async (
    ctx,
    { userId, imageBase64, mediaType = "image/jpeg", autoLogAsMealType },
  ): Promise<{
    scanResultId: string;
    mealLogId?: Id<"mealLogs">;
    items: ScanItem[];
    totalCal: number;
    totalProtein: number;
    mealType?: string;
  }> => {
    if (imageBase64.length < 100) throw new Error("Image data invalid — please retry.");
    if (imageBase64.length > 10 * 1024 * 1024) throw new Error("Image too large — please use under 7MB.");

    await ctx.runMutation(internal.scan.enforceScanRateLimit, { userId });

    let items: ScanItem[];
    try {
      items = await scan(imageBase64, mediaType);
    } catch (err) {
      const first = classifyError(err);
      if (first.code === "parse") {
        items = await scan(imageBase64, mediaType);
      } else {
        throw new Error(first.userMessage, { cause: err });
      }
    }

    const cleaned = items.filter(validateItem);
    if (cleaned.length === 0) {
      throw new Error("No food detected — try better lighting or a closer shot.");
    }

    const totalCal = cleaned.reduce((s, i) => s + i.cal, 0);
    const totalProtein = cleaned.reduce((s, i) => s + i.protein, 0);

    const scanResultId: string = await ctx.runMutation(internal.scan.saveScanResultInternal, {
      userId,
      items: cleaned,
      rawItems: cleaned,
      totalCal,
      totalProtein,
      confidence: 0.9,
    });

    let mealLogId: Id<"mealLogs"> | undefined;
    if (autoLogAsMealType) {
      mealLogId = await ctx.runMutation(internal.meals.logMealForUser, {
        userId,
        date: new Date().toISOString().split("T")[0],
        mealType: autoLogAsMealType,
        items: cleaned.map((i) => ({
          name: i.name,
          portion: i.portion,
          cal: i.cal,
          protein: i.protein,
          carbs: i.carbs,
          fat: i.fat,
        })),
        totalCal,
      });
    } else {
      // Still emit the scan_completed event so the nudge engine fires
      await ctx.runMutation(internal.nudges.queue.enqueue, {
        userId,
        type: "scan_completed",
        payload: { totalCal, itemCount: cleaned.length },
      });
    }

    return { scanResultId, mealLogId, items: cleaned, totalCal, totalProtein, mealType: autoLogAsMealType };
  },
});

// ─── Telegram text-intake entry point ─────────────────────────────────
// Mirrors scanMealAsUser but takes a free-text message instead of an
// image. Reuses the same scanResults table + the same `log:` callback
// flow, so once items are extracted the user gets the same buttons and
// the same confirmation dance — a typed meal becomes a real mealLog
// only after the user taps "Log as Lunch" (or whichever).

export const extractMealFromTextAsUser = internalAction({
  args: {
    userId: v.id("users"),
    message: v.string(),
  },
  handler: async (
    ctx,
    { userId, message },
  ): Promise<
    | { intent: "log_meal"; scanResultId: string; items: ScanItem[]; totalCal: number; totalProtein: number }
    | { intent: "chat" }
  > => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return { intent: "chat" };
    if (trimmed.length > 800) {
      // Very long messages are almost always rambling chat, not a meal log.
      // Skip the extractor call entirely so we don't waste a Gemini round-trip.
      return { intent: "chat" };
    }

    let extract: TextExtractResult;
    try {
      extract = await extractFromText(trimmed);
    } catch (err) {
      const c = classifyError(err);
      if (c.code === "parse") {
        // Bad JSON from the model — treat as chat so the user still gets a reply.
        return { intent: "chat" };
      }
      throw new Error(c.userMessage, { cause: err });
    }

    if (extract.intent !== "log_meal") return { intent: "chat" };

    // Charge a scan against rate-limit/quota only when we actually extracted
    // a meal — chat fall-throughs shouldn't burn the user's scan budget.
    await ctx.runMutation(internal.scan.enforceScanRateLimit, { userId });

    const scanResultId: string = await ctx.runMutation(internal.scan.saveScanResultInternal, {
      userId,
      items: extract.items,
      rawItems: extract.items,
      totalCal: extract.totalCal,
      totalProtein: extract.totalProtein,
      confidence: extract.confidence,
    });

    await ctx.runMutation(internal.nudges.queue.enqueue, {
      userId,
      type: "scan_completed",
      payload: { totalCal: extract.totalCal, itemCount: extract.items.length, source: "text" },
    });

    return {
      intent: "log_meal",
      scanResultId,
      items: extract.items,
      totalCal: extract.totalCal,
      totalProtein: extract.totalProtein,
    };
  },
});

export const enforceScanRateLimit = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const limitKey = isUnlimitedUser(user?.email ?? null) ? "scan" : "scan_free";
    await checkRateLimit(ctx, userId, limitKey);
    // Plan-based quota: counts now, blocks once ENFORCE_QUOTA is flipped on
    await enforceUserQuota(ctx, userId, "scan", { enforce: ENFORCE_QUOTA });
  },
});

export const saveScanResultInternal = internalMutation({
  args: {
    userId: v.id("users"),
    items: v.array(v.object({
      name: v.string(), portion: v.string(),
      cal: v.number(), protein: v.number(), carbs: v.number(), fat: v.number(),
    })),
    rawItems: v.array(v.object({
      name: v.string(), portion: v.string(),
      cal: v.number(), protein: v.number(), carbs: v.number(), fat: v.number(),
    })),
    totalCal: v.number(),
    totalProtein: v.optional(v.number()),
    confidence: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Respect user's photo storage preference — if disabled, delete the uploaded blob
    const profile = await ctx.db.query("profiles")
      .withIndex("by_userId", q => q.eq("userId", args.userId))
      .unique();
    const allowPhoto = profile?.allowPhotoStorage !== false; // default true
    let finalImageStorageId: string | undefined = args.imageStorageId;
    if (args.imageStorageId && !allowPhoto) {
      await ctx.storage.delete(args.imageStorageId);
      finalImageStorageId = undefined;
    }

    const scanResultId = await ctx.db.insert("scanResults", {
      userId: args.userId,
      items: args.items,
      rawItems: args.rawItems,
      totalCal: args.totalCal,
      totalProtein: args.totalProtein,
      confidence: args.confidence,
      imageStorageId: finalImageStorageId as never,
      edited: false,
      createdAt: Date.now(),
    });

    if (profile) await ctx.db.patch(profile._id, { scanCount: (profile.scanCount ?? 0) + 1 });
    return scanResultId;
  },
});

// ─── Internal-callable scan retrieval + consume markers ─────────────────
// Used by the Telegram inline-button flow: the photo-handler stores a
// scanResults row, replies with buttons keyed by scanResultId, and the
// callback handler reads it back here, logs the meal, and stamps the
// scan as consumed so re-tapping the button is a no-op.

export const getScanResultForUser = internalQuery({
  args: { scanResultId: v.id("scanResults"), userId: v.id("users") },
  handler: async (ctx, { scanResultId, userId }) => {
    const scan = await ctx.db.get(scanResultId);
    if (!scan || scan.userId !== userId) return null;
    return scan;
  },
});

export const markScanConsumed = internalMutation({
  args: {
    scanResultId: v.id("scanResults"),
    userId: v.id("users"),
    mealLogId: v.id("mealLogs"),
  },
  handler: async (ctx, { scanResultId, userId, mealLogId }) => {
    const scan = await ctx.db.get(scanResultId);
    if (!scan || scan.userId !== userId) return;
    await ctx.db.patch(scanResultId, {
      consumedAt: Date.now(),
      consumedAsMealLogId: mealLogId,
    });
  },
});
