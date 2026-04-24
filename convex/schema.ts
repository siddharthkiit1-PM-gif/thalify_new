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
  }).index("by_userId", ["userId"]),

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
    confidence: v.number(),
    items: v.array(v.object({
      name: v.string(),
      portion: v.string(),
      cal: v.number(),
      protein: v.number(),
      carbs: v.number(),
      fat: v.number(),
    })),
    totalCal: v.number(),
    totalProtein: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

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
});
