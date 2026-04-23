import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { CLAUDE_MODEL, getClient, extractText, extractJson, classifyError } from "./ai/claude";

const LAB_SYSTEM = `You are a clinical nutritionist who specializes in interpreting Indian patients' lab reports and translating results into actionable dietary guidance.

Analyze the lab report image carefully. Extract all visible test values and provide nutrition recommendations.

Return ONLY a valid JSON object with this exact shape:
{
  "markers": [
    {"name": "HbA1c", "value": "6.2", "unit": "%", "status": "borderline", "range": "below 5.7 is normal"}
  ],
  "summary": "One paragraph plain-English summary of overall health picture",
  "dietaryChanges": [
    "Reduce refined carbohydrates: white rice, maida, sugar",
    "Add more leafy greens for iron"
  ],
  "indianFoodRecommendations": [
    "Replace white rice with red rice or millets like ragi or jowar",
    "Add methi leaves in sabzi to help blood sugar"
  ],
  "urgentFlags": ["HbA1c is in pre-diabetic range — please consult your doctor"],
  "disclaimer": "This analysis is for nutritional guidance only. Please consult your doctor for medical advice."
}

Status values: normal | borderline | high | low | critical

If a value is not visible or not present in the report, omit that marker.
Return ONLY the JSON object. No markdown, no code fences, no explanation.`;

type LabResult = {
  markers: { name: string; value: string; unit: string; status: string; range: string }[];
  summary: string;
  dietaryChanges: string[];
  indianFoodRecommendations: string[];
  urgentFlags: string[];
  disclaimer: string;
};

export const analyzeLabReport = action({
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

    let result: LabResult;
    try {
      const client = getClient();
      const msg = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: LAB_SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: "Analyze this lab report and return the JSON with markers, dietary recommendations, and Indian food suggestions." }
          ]
        }],
      });
      result = extractJson<LabResult>(extractText(msg));
    } catch (err) {
      throw new Error(classifyError(err).userMessage);
    }

    if (!result.markers || !Array.isArray(result.markers)) {
      throw new Error("Could not read lab values — try a clearer image of the report.");
    }

    await ctx.runMutation(api.lab.saveLabResult, { userId, result });
    return result;
  },
});

export const saveLabResult = mutation({
  args: {
    userId: v.id("users"),
    result: v.object({
      markers: v.array(v.object({
        name: v.string(),
        value: v.string(),
        unit: v.string(),
        status: v.string(),
        range: v.string(),
      })),
      summary: v.string(),
      dietaryChanges: v.array(v.string()),
      indianFoodRecommendations: v.array(v.string()),
      urgentFlags: v.array(v.string()),
      disclaimer: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.insert("labResults", { userId, result: args.result, createdAt: Date.now() });
  },
});

export const getLabResults = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("labResults")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .order("desc")
      .take(10);
  },
});
