import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { matchTrigger } from "./rules";
import { computeSignal } from "./signal";
import {
  withinFrequencyCap,
  passesBucketDedup,
  isInQuietHours,
  isStale,
  getISTHour,
  frequencyCapForPlan,
} from "./gatekeepers";
import { pickTemplate } from "./templatePicker";
import { writeNudge } from "./aiWriter";
import type { MockEvent } from "../__fixtures__/nudges";
import type { Doc, Id } from "../_generated/dataModel";

const BATCH_SIZE = 50;

// User-initiated events bypass quiet hours: if the user is actively logging
// at 1 AM, they're awake and a real-time nudge is useful. Their phone's own
// DND handles audible silence. Cron-initiated events still respect quiet
// hours so we don't ping anyone at 3 AM with re-engagement prompts.
const USER_INITIATED_EVENT_TYPES = new Set([
  "meal_logged",
  "scan_completed",
]);

export const processNudgeQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    if (process.env.NUDGES_ENABLED === "false") {
      return { processed: 0, total: 0, reason: "disabled" };
    }

    const events: Doc<"nudgeEvents">[] = await ctx.runQuery(
      internal.nudges.worker.queryPending,
      { limit: BATCH_SIZE },
    );
    let processed = 0;
    for (const event of events) {
      try {
        await ctx.runAction(internal.nudges.worker.processSingleEvent, {
          eventId: event._id,
        });
        processed++;
      } catch (err) {
        console.error(`event ${event._id} failed`, err);
        await ctx.runMutation(internal.nudges.worker.markEventFailed, {
          eventId: event._id,
        });
      }
    }
    return { processed, total: events.length };
  },
});

export const queryPending = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("nudgeEvents")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(limit);
  },
});

export const processSingleEvent = internalAction({
  args: { eventId: v.id("nudgeEvents") },
  handler: async (ctx, { eventId }) => {
    const event: Doc<"nudgeEvents"> | null = await ctx.runQuery(
      internal.nudges.worker.getEvent,
      { eventId },
    );
    if (!event || event.status !== "pending") return;

    const now = Date.now();

    if (isStale(event.createdAt, now)) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "stale" });
      return;
    }

    if (!USER_INITIATED_EVENT_TYPES.has(event.type)) {
      const hour = getISTHour();
      if (isInQuietHours(hour)) {
        await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "quiet" });
        return;
      }
    }

    type UserStateResult = {
      userId: Id<"users">;
      name: string;
      goal: "lose" | "maintain" | "diabetes" | "gain";
      dietType: "veg" | "veg_eggs" | "nonveg" | "jain" | "vegan";
      calorieGoal: number;
      plan?: "free" | "lifetime";
      weightKg?: number;
      heightCm?: number;
      age?: number;
      totalCalToday: number;
      mealCountToday: number;
      hasBreakfastToday: boolean;
      hasLunchToday: boolean;
      hasDinnerToday: boolean;
      notifsLast24h: number;
      lastBucketTimestamps: Record<string, number>;
      whatsappOptIn: boolean;
      whatsappNumber?: string;
      telegramOptIn: boolean;
      telegramChatId?: string;
    };
    const state: UserStateResult | null = await ctx.runQuery(
      internal.nudges.worker.buildUserState,
      { userId: event.userId },
    );
    if (!state) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, {
        eventId,
        reason: "no-profile",
      });
      return;
    }

    const eventForMatcher: MockEvent = {
      type: event.type,
      payload: event.payload ?? {},
      createdAt: event.createdAt,
    };
    const match = matchTrigger(eventForMatcher, state);
    if (!match) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, {
        eventId,
        reason: "no-match",
      });
      return;
    }

    // Triggers exempt from cap + dedup. These are scheduled or user-initiated
    // signals that the user explicitly opted in for — water reminders, per-
    // meal buddy insight, and the 7pm "have you eaten?" check. They should
    // always fire. Other triggers (re-engagement, food-repetition, upgrade)
    // still respect the cap so non-essential nudges don't pile up.
    const UNTHROTTLED_TRIGGERS = new Set([
      "post-meal-insight",
      "water-check",
      "daily-log-prompt",
    ]);
    const isUnthrottled = UNTHROTTLED_TRIGGERS.has(match.trigger);

    if (!isUnthrottled) {
      const cap = frequencyCapForPlan(state.plan);
      if (!withinFrequencyCap(state.notifsLast24h, cap)) {
        await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "cap" });
        return;
      }
      if (!passesBucketDedup(state.lastBucketTimestamps[match.bucket], now)) {
        await ctx.runMutation(internal.nudges.worker.skipEvent, { eventId, reason: "dedup" });
        return;
      }
    }

    const signal = computeSignal(match.trigger, state);

    const templates: Doc<"nudgeTemplates">[] = await ctx.runQuery(
      internal.nudges.worker.getTemplatesForTrigger,
      { bucket: match.bucket, trigger: match.trigger },
    );
    if (templates.length === 0) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, {
        eventId,
        reason: "no-template",
      });
      return;
    }
    const template = pickTemplate(templates);
    if (!template) {
      await ctx.runMutation(internal.nudges.worker.skipEvent, {
        eventId,
        reason: "no-template",
      });
      return;
    }

    const lastMealName = (event.payload?.mealName as string | undefined) ?? undefined;
    const repeatedFood = (event.payload?.foodName as string | undefined) ?? undefined;
    const mealItems = (event.payload?.itemNames as string[] | undefined) ?? undefined;
    const mealCal = (event.payload?.totalCal as number | undefined) ?? undefined;
    const written = await writeNudge({
      name: state.name,
      goal: state.goal,
      trigger: match.trigger,
      template: template.template,
      signal,
      lastMealName,
      food: repeatedFood,
      weightKg: state.weightKg,
      calorieGoal: state.calorieGoal,
      // Rich per-meal context — used by post-meal-insight prompt
      mealItems,
      mealCal,
      totalCalToday: state.totalCalToday,
      dietType: state.dietType,
    });

    let expiresAt: number | undefined;
    const todayMidnightIST = new Date();
    todayMidnightIST.setUTCHours(18, 30, 0, 0);
    if (match.trigger === "breakfast-skipped") {
      const lunchTime = new Date();
      lunchTime.setUTCHours(7, 30, 0, 0);
      if (lunchTime.getTime() < now) lunchTime.setDate(lunchTime.getDate() + 1);
      expiresAt = lunchTime.getTime();
    } else if (match.trigger === "lunch-skipped") {
      const dinnerTime = new Date();
      dinnerTime.setUTCHours(13, 30, 0, 0);
      if (dinnerTime.getTime() < now) dinnerTime.setDate(dinnerTime.getDate() + 1);
      expiresAt = dinnerTime.getTime();
    } else if (match.trigger === "dinner-skipped") {
      expiresAt = todayMidnightIST.getTime();
    }

    const notificationId: Id<"notifications"> = await ctx.runMutation(
      internal.nudges.worker.persistNudge,
      {
        eventId,
        userId: event.userId,
        bucket: match.bucket,
        message: written.message,
        trigger: match.trigger,
        templateId: template._id,
        variant: template.variant,
        signalPrediction: signal ?? undefined,
        expiresAt,
        aiFallback: written.aiFallback,
      },
    );

    if (state.telegramOptIn && state.telegramChatId) {
      const { sendText: sendTelegram } = await import("../telegram/adapter");
      const result = await sendTelegram(state.telegramChatId, written.message);
      if (result.success) {
        await ctx.runMutation(internal.nudges.worker.markTelegramDelivered, {
          notificationId,
          messageId: result.messageId ?? "",
        });
      } else {
        console.warn(
          `telegram send failed for ${event.userId}: ${result.error}`,
        );
      }
    }

    if (state.whatsappOptIn && state.whatsappNumber) {
      const { sendText } = await import("../whatsapp/adapter");
      const result = await sendText(state.whatsappNumber, written.message);
      if (result.success) {
        await ctx.runMutation(internal.nudges.worker.markWhatsappDelivered, {
          notificationId,
          messageId: result.messageId ?? "",
        });
      } else {
        console.warn(
          `whatsapp send failed for ${event.userId}: ${result.error}`,
        );
      }
    }

    return notificationId;
  },
});

export const markWhatsappDelivered = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    messageId: v.string(),
  },
  handler: async (ctx, { notificationId, messageId }) => {
    await ctx.db.patch(notificationId, {
      deliveredViaWhatsApp: true,
      whatsappMessageId: messageId,
    });
  },
});

export const markTelegramDelivered = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    messageId: v.string(),
  },
  handler: async (ctx, { notificationId, messageId }) => {
    await ctx.db.patch(notificationId, {
      deliveredViaTelegram: true,
      telegramMessageId: messageId,
    });
  },
});

export const getEvent = internalQuery({
  args: { eventId: v.id("nudgeEvents") },
  handler: async (ctx, { eventId }) => await ctx.db.get(eventId),
});

export const buildUserState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return null;
    const user = await ctx.db.get(userId);

    const today = new Date().toISOString().split("T")[0];
    const todayLogs = await ctx.db
      .query("mealLogs")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", today))
      .collect();

    const totalCalToday = todayLogs.reduce((sum, l) => sum + l.totalCal, 0);
    const hasBreakfastToday = todayLogs.some((l) => l.mealType === "breakfast");
    const hasLunchToday = todayLogs.some((l) => l.mealType === "lunch");
    const hasDinnerToday = todayLogs.some((l) => l.mealType === "dinner");

    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const recentNotifs = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gt("createdAt", dayAgo),
      )
      .collect();

    const lastBucketTimestamps: Record<string, number> = {};
    for (const n of recentNotifs) {
      if (
        !lastBucketTimestamps[n.bucket] ||
        n.createdAt > lastBucketTimestamps[n.bucket]
      ) {
        lastBucketTimestamps[n.bucket] = n.createdAt;
      }
    }

    return {
      userId,
      name: user?.name ?? "there",
      goal: profile.goal,
      dietType: profile.dietType,
      calorieGoal: profile.calorieGoal,
      plan: profile.plan ?? "free",
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: profile.age,
      totalCalToday,
      mealCountToday: todayLogs.length,
      hasBreakfastToday,
      hasLunchToday,
      hasDinnerToday,
      notifsLast24h: recentNotifs.length,
      lastBucketTimestamps,
      whatsappOptIn: profile.whatsappOptIn === true,
      whatsappNumber: profile.whatsappNumber,
      telegramOptIn: profile.telegramOptIn === true,
      telegramChatId: profile.telegramChatId,
    };
  },
});

export const getTemplatesForTrigger = internalQuery({
  args: { bucket: v.string(), trigger: v.string() },
  handler: async (ctx, { bucket, trigger }) => {
    const templates = await ctx.db
      .query("nudgeTemplates")
      .withIndex("by_trigger_active", (q) =>
        q.eq("trigger", trigger).eq("active", true),
      )
      .collect();
    if (templates.length > 0) return templates;
    return await ctx.db
      .query("nudgeTemplates")
      .withIndex("by_bucket_active", (q) =>
        q.eq("bucket", bucket as never).eq("active", true),
      )
      .collect();
  },
});

export const skipEvent = internalMutation({
  args: { eventId: v.id("nudgeEvents"), reason: v.string() },
  handler: async (ctx, { eventId, reason }) => {
    await ctx.db.patch(eventId, {
      status: "skipped",
      skipReason: reason,
      processedAt: Date.now(),
    });
  },
});

export const markEventFailed = internalMutation({
  args: { eventId: v.id("nudgeEvents") },
  handler: async (ctx, { eventId }) => {
    await ctx.db.patch(eventId, { status: "failed", processedAt: Date.now() });
  },
});

export const persistNudge = internalMutation({
  args: {
    eventId: v.id("nudgeEvents"),
    userId: v.id("users"),
    bucket: v.union(
      v.literal("hydration"),
      v.literal("movement"),
      v.literal("praise"),
      v.literal("recovery"),
      v.literal("prompt"),
      v.literal("reflection"),
      v.literal("plan"),
    ),
    message: v.string(),
    trigger: v.string(),
    templateId: v.id("nudgeTemplates"),
    variant: v.string(),
    signalPrediction: v.optional(
      v.object({
        savedCalsPerDay: v.number(),
        kg7Days: v.number(),
        kg30Days: v.number(),
        context: v.string(),
      }),
    ),
    expiresAt: v.optional(v.number()),
    aiFallback: v.boolean(),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      bucket: args.bucket,
      message: args.message,
      trigger: args.trigger,
      templateId: args.templateId,
      variant: args.variant,
      signalPrediction: args.signalPrediction,
      expiresAt: args.expiresAt,
      aiFallback: args.aiFallback || undefined,
      read: false,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.eventId, {
      status: "processed",
      processedAt: Date.now(),
      notificationId,
    });
    return notificationId;
  },
});
