import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { calculateTDEE, calculateTarget } from "./lib/calorie";

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

// Internal-callable variant — used by the Telegram webhook (no auth context)
export const getProfileForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getUserByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { _id: user._id, name: user.name ?? null, email: user.email ?? null };
  },
});

/**
 * Frontend query for the account / upgrade page — shows current plan, founder
 * number (if applicable), this month's usage, and how much is left.
 */
export const getMyQuotaStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return null;
    return {
      plan: profile.plan ?? "free",
      lifetimeReason: profile.lifetimeReason ?? null,
      founderNumber: profile.founderNumber ?? null,
      paidAt: profile.paidAt ?? null,
      resetsAt: profile.usageResetAt ?? null,
      usage: {
        scan: profile.freeScansUsedThisMonth ?? 0,
        chat: profile.freeChatsUsedThisMonth ?? 0,
        lab: profile.freeLabsUsedThisMonth ?? 0,
        family: profile.freeFamilyUsedThisMonth ?? 0,
        pattern: profile.freePatternsUsedThisMonth ?? 0,
      },
      lifetimeTokensUsed: profile.tokensUsedThisMonth ?? 0,
    };
  },
});

/**
 * How many of the 50 founder slots are filled. Public — drives the
 * "X of 50 spots left" urgency on the upgrade page.
 */
export const getFounderSlotsRemaining = query({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", "founders_paid"))
      .unique();
    const filled = counter?.value ?? 0;
    return { filled, total: 50, remaining: Math.max(0, 50 - filled) };
  },
});

const ADMIN_EMAILS = new Set([
  "siddharth.kiit1@gmail.com",
  "agrawalsiddharth18@gmail.com",
  "agrawalsiddharth66@gmail.com",
]);

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const email = user.email ?? null;
    return {
      _id: user._id,
      email,
      name: user.name ?? null,
      isAdmin: email ? ADMIN_EMAILS.has(email.toLowerCase()) : false,
    };
  },
});

export const setPhotoStoragePreference = mutation({
  args: { allow: v.boolean() },
  handler: async (ctx, { allow }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Complete onboarding first");
    await ctx.db.patch(profile._id, { allowPhotoStorage: allow });
  },
});

export const createProfile = mutation({
  args: {
    goal: v.union(v.literal("lose"), v.literal("maintain"), v.literal("diabetes"), v.literal("gain")),
    dietType: v.union(v.literal("veg"), v.literal("veg_eggs"), v.literal("nonveg"), v.literal("jain"), v.literal("vegan")),
    city: v.union(v.literal("bangalore"), v.literal("mumbai"), v.literal("delhi"), v.literal("other")),
    allergies: v.array(v.string()),
    dislikes: v.array(v.string()),
    allowPhotoStorage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const calorieGoalMap = { lose: 1600, maintain: 1900, diabetes: 1700, gain: 2300 };

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      return await ctx.db.patch(existing._id, {
        ...args,
        calorieGoal: calorieGoalMap[args.goal],
        onboardingComplete: true,
      });
    }

    return await ctx.db.insert("profiles", {
      userId,
      ...args,
      calorieGoal: calorieGoalMap[args.goal],
      onboardingComplete: true,
      scanCount: 0,
    });
  },
});

export const updateBodyStats = mutation({
  args: {
    weightKg: v.number(),
    heightCm: v.number(),
    age: v.number(),
    sex: v.union(v.literal("male"), v.literal("female"), v.literal("other")),
    activityLevel: v.union(
      v.literal("sedentary"),
      v.literal("light"),
      v.literal("moderate"),
      v.literal("active"),
      v.literal("very_active"),
    ),
    bodyFatPct: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.weightKg < 30 || args.weightKg > 300) throw new Error("Weight must be between 30 and 300 kg");
    if (args.heightCm < 100 || args.heightCm > 250) throw new Error("Height must be between 100 and 250 cm");
    if (args.age < 13 || args.age > 100) throw new Error("Age must be between 13 and 100");
    if (args.bodyFatPct !== undefined && (args.bodyFatPct < 3 || args.bodyFatPct > 60)) {
      throw new Error("Body fat % must be between 3 and 60");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Complete onboarding first");

    const { tdee } = calculateTDEE(args);
    const target = calculateTarget(tdee, profile.goal);

    await ctx.db.patch(profile._id, {
      weightKg: args.weightKg,
      heightCm: args.heightCm,
      age: args.age,
      sex: args.sex,
      activityLevel: args.activityLevel,
      bodyFatPct: args.bodyFatPct,
      tdee,
      calorieGoal: target,
    });

    return { tdee, target };
  },
});
