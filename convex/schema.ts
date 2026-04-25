import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    goal: v.union(v.literal("lose"), v.literal("maintain"), v.literal("diabetes"), v.literal("gain")),
    dietType: v.union(v.literal("veg"), v.literal("veg_eggs"), v.literal("nonveg"), v.literal("jain"), v.literal("vegan")),
    city: v.union(v.literal("bangalore"), v.literal("mumbai"), v.literal("delhi"), v.literal("other")),
    allergies: v.array(v.string()),
    dislikes: v.array(v.string()),
    onboardingComplete: v.boolean(),
    calorieGoal: v.number(),
    scanCount: v.number(),
    // Body stats (optional — computed TDEE + personalized target when filled)
    weightKg: v.optional(v.number()),
    heightCm: v.optional(v.number()),
    age: v.optional(v.number()),
    sex: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    activityLevel: v.optional(v.union(
      v.literal("sedentary"),
      v.literal("light"),
      v.literal("moderate"),
      v.literal("active"),
      v.literal("very_active"),
    )),
    bodyFatPct: v.optional(v.number()),
    tdee: v.optional(v.number()),
    // User can opt-out of photo storage (defaults to true = store photos for training)
    allowPhotoStorage: v.optional(v.boolean()),
    // WhatsApp delivery for nudges (separate consent flow with 6-digit verification)
    whatsappNumber: v.optional(v.string()),       // E.164: "+919876543210"
    whatsappOptIn: v.optional(v.boolean()),
    whatsappVerifiedAt: v.optional(v.number()),
    whatsappPendingCode: v.optional(v.string()),
    whatsappPendingCodeExpiresAt: v.optional(v.number()),
    telegramChatId: v.optional(v.string()),
    telegramOptIn: v.optional(v.boolean()),
    telegramVerifiedAt: v.optional(v.number()),
    telegramConnectToken: v.optional(v.string()),
    telegramConnectExpiresAt: v.optional(v.number()),
    // Optional running thread the AI uses for short-context replies on Telegram
    telegramLastInteractionAt: v.optional(v.number()),
  }).index("by_userId", ["userId"])
    .index("by_telegramChatId", ["telegramChatId"]),

  mealLogs: defineTable({
    userId: v.id("users"),
    date: v.string(),
    mealType: v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("snack"), v.literal("dinner")),
    items: v.array(v.object({
      name: v.string(),
      portion: v.string(),
      cal: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    })),
    totalCal: v.number(),
    imageUrl: v.optional(v.string()),
  }).index("by_userId_date", ["userId", "date"]),

  scanResults: defineTable({
    userId: v.id("users"),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    confidence: v.number(),
    // items is the FINAL version the user logged (may equal rawItems if untouched).
    // Kept on top level for backwards compatibility with existing code.
    items: v.array(v.object({
      name: v.string(),
      portion: v.string(),
      cal: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    })),
    // rawItems = what Gemini returned, BEFORE any user edits (training signal).
    rawItems: v.optional(v.array(v.object({
      name: v.string(),
      portion: v.string(),
      cal: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    }))),
    edited: v.optional(v.boolean()),
    userFeedback: v.optional(v.union(v.literal("accurate"), v.literal("inaccurate"), v.literal("partial"))),
    feedbackNotes: v.optional(v.string()),
    totalCal: v.number(),
    totalProtein: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]).index("by_createdAt", ["createdAt"]),

  chatMessages: defineTable({
    userId: v.id("users"),
    from: v.union(v.literal("user"), v.literal("ai")),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  familyMenus: defineTable({
    userId: v.id("users"),
    date: v.string(),
    dishes: v.array(v.string()),
    optimizedPlate: v.array(v.object({
      name: v.string(),
      action: v.union(v.literal("keep"), v.literal("reduce"), v.literal("skip"), v.literal("add")),
      recommendation: v.string(),
      cal: v.number(),
    })),
  }).index("by_userId", ["userId"]),

  labResults: defineTable({
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
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  waitlist: defineTable({
    email: v.string(),
    createdAt: v.number(),
  }),

  rateLimits: defineTable({
    key: v.string(),
    events: v.array(v.number()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // ─── Nudge engine (events queue, template library, output notifications) ───
  nudgeEvents: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("meal_logged"),
      v.literal("scan_completed"),
      v.literal("time_breakfast_check"),
      v.literal("time_lunch_check"),
      v.literal("time_dinner_check"),
      v.literal("time_daily_summary"),
      v.literal("streak_milestone"),
      v.literal("gap_detected"),
      v.literal("weekly_insight"),
    ),
    payload: v.optional(v.any()),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    notificationId: v.optional(v.id("notifications")),
    processedAt: v.optional(v.number()),
    skipReason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_status_createdAt", ["status", "createdAt"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  nudgeTemplates: defineTable({
    bucket: v.union(
      v.literal("hydration"), v.literal("movement"), v.literal("praise"),
      v.literal("recovery"), v.literal("prompt"), v.literal("reflection"),
      v.literal("plan"),
    ),
    trigger: v.string(),
    variant: v.string(),
    template: v.string(),
    active: v.boolean(),
    weight: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_bucket_active", ["bucket", "active"])
    .index("by_trigger_active", ["trigger", "active"]),

  notifications: defineTable({
    userId: v.id("users"),
    bucket: v.union(
      v.literal("hydration"), v.literal("movement"), v.literal("praise"),
      v.literal("recovery"), v.literal("prompt"), v.literal("reflection"),
      v.literal("plan"),
    ),
    message: v.string(),
    trigger: v.string(),
    templateId: v.optional(v.id("nudgeTemplates")),
    variant: v.optional(v.string()),
    signalPrediction: v.optional(v.object({
      savedCalsPerDay: v.number(),
      kg7Days: v.number(),
      kg30Days: v.number(),
      context: v.string(),
    })),
    expiresAt: v.optional(v.number()),
    aiFallback: v.optional(v.boolean()),
    deliveredViaWhatsApp: v.optional(v.boolean()),
    whatsappMessageId: v.optional(v.string()),
    deliveredViaTelegram: v.optional(v.boolean()),
    telegramMessageId: v.optional(v.string()),
    read: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_bucket_createdAt", ["userId", "bucket", "createdAt"])
    .index("by_variant_createdAt", ["variant", "createdAt"]),
});
