import { internalMutation, internalAction, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Single-email admin gate for personal-stats endpoints. */
const PERSONAL_ADMIN_EMAIL = "agrawalsiddharth66@gmail.com";

/**
 * Diagnostic: why are Telegram nudges not landing for a given user?
 * Returns telegram-binding state + last 10 events + last 10 notifications.
 *
 * Call: npx convex run admin:diagnoseNudgesForEmail --prod '{"email":"x@y.com"}'
 */
export const diagnoseNudgesForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), normalized))
      .first();
    if (!user) return { error: "no user with that email" };

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const events = await ctx.db
      .query("nudgeEvents")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);

    const notifs = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);

    return {
      user: { _id: user._id, email: user.email, name: user.name },
      telegram: {
        optIn: profile?.telegramOptIn === true,
        chatId: profile?.telegramChatId ?? null,
      },
      plan: profile?.plan ?? "free",
      events: events.map((e) => ({
        type: e.type,
        status: e.status,
        skipReason: e.skipReason ?? null,
        createdAt: new Date(e.createdAt).toISOString(),
        processedAt: e.processedAt ? new Date(e.processedAt).toISOString() : null,
      })),
      notifications: notifs.map((n) => ({
        bucket: n.bucket,
        trigger: n.trigger,
        message: n.message.slice(0, 120),
        deliveredViaTelegram: n.deliveredViaTelegram === true,
        deliveredViaWhatsApp: n.deliveredViaWhatsApp === true,
        createdAt: new Date(n.createdAt).toISOString(),
        aiFallback: n.aiFallback === true,
      })),
    };
  },
});

/**
 * Personal-admin daily stats. CLI-callable bypassing auth.
 *
 * Call via: npx convex run admin:dailyActiveUsersInternal --prod
 */
export const dailyActiveUsersInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    const todayLogs = await ctx.db
      .query("mealLogs")
      .filter((q) => q.eq(q.field("date"), today))
      .collect();
    const distinctLogUsers = new Set(todayLogs.map((l) => l.userId));

    const startOfTodayMs = new Date(today + "T00:00:00.000Z").getTime();
    const recentScans = await ctx.db
      .query("scanResults")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", startOfTodayMs))
      .collect();
    const distinctScanUsers = new Set(recentScans.map((s) => s.userId));

    const totalUsers = await ctx.db.query("users").collect();
    const allProfiles = await ctx.db.query("profiles").collect();
    const paidUsers = allProfiles.filter((p) => p.plan === "lifetime").length;
    const founderCounter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", "founders_paid"))
      .unique();
    const foundersFilled = founderCounter?.value ?? 0;

    const allPayments = await ctx.db.query("payments").collect();
    const captured = allPayments.filter((p) => p.status === "captured");
    const refunded = allPayments.filter((p) => p.status === "refunded");
    const failed = allPayments.filter((p) => p.status === "failed");
    const created = allPayments.filter((p) => p.status === "created");
    const revenueRupees = captured.reduce((s, p) => s + p.amount, 0) / 100;
    const refundedRupees = refunded.reduce((s, p) => s + p.amount, 0) / 100;

    return {
      date: today,
      distinctUsersWhoLoggedAMealToday: distinctLogUsers.size,
      totalMealLogsToday: todayLogs.length,
      distinctUsersWhoScannedToday: distinctScanUsers.size,
      totalScansToday: recentScans.length,
      totalUsersInDatabase: totalUsers.length,
      paidUsers,
      foundersFilled,
      foundersTotal: 50,
      foundersRemaining: Math.max(0, 50 - foundersFilled),
      paymentsCaptured: captured.length,
      paymentsRefunded: refunded.length,
      paymentsFailed: failed.length,
      paymentsCreatedNotCompleted: created.length,
      revenueRupees,
      refundedRupees,
      netRevenueRupees: revenueRupees - refundedRupees,
    };
  },
});

/**
 * Public-query version of the same stats. Returns null for any caller
 * whose authenticated email isn't agrawalsiddharth66@gmail.com — so the
 * UI can render an admin-only widget without leaking counts to anyone
 * else, even if they reverse-engineer the function name.
 */
export const dailyActiveUsers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user || user.email !== PERSONAL_ADMIN_EMAIL) return null;

    const today = new Date().toISOString().split("T")[0];

    const todayLogs = await ctx.db
      .query("mealLogs")
      .filter((q) => q.eq(q.field("date"), today))
      .collect();
    const distinctLogUsers = new Set(todayLogs.map((l) => l.userId));

    const startOfTodayMs = new Date(today + "T00:00:00.000Z").getTime();
    const recentScans = await ctx.db
      .query("scanResults")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", startOfTodayMs))
      .collect();
    const distinctScanUsers = new Set(recentScans.map((s) => s.userId));

    const totalUsers = await ctx.db.query("users").collect();

    // Paid (lifetime plan) user count + founder-slot status.
    const allProfiles = await ctx.db.query("profiles").collect();
    const paidUsers = allProfiles.filter((p) => p.plan === "lifetime").length;
    const founderCounter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", "founders_paid"))
      .unique();
    const foundersFilled = founderCounter?.value ?? 0;

    // Razorpay payments audit — counts + revenue by status. Amounts are in
    // paise (9900 = ₹99) so we divide by 100 for the rupee total.
    const allPayments = await ctx.db.query("payments").collect();
    const captured = allPayments.filter((p) => p.status === "captured");
    const refunded = allPayments.filter((p) => p.status === "refunded");
    const failed = allPayments.filter((p) => p.status === "failed");
    const created = allPayments.filter((p) => p.status === "created");
    const revenueRupees = captured.reduce((s, p) => s + p.amount, 0) / 100;
    const refundedRupees = refunded.reduce((s, p) => s + p.amount, 0) / 100;

    return {
      date: today,
      distinctUsersWhoLoggedAMealToday: distinctLogUsers.size,
      totalMealLogsToday: todayLogs.length,
      distinctUsersWhoScannedToday: distinctScanUsers.size,
      totalScansToday: recentScans.length,
      totalUsersInDatabase: totalUsers.length,
      paidUsers,
      foundersFilled,
      foundersTotal: 50,
      foundersRemaining: Math.max(0, 50 - foundersFilled),
      paymentsCaptured: captured.length,
      paymentsRefunded: refunded.length,
      paymentsFailed: failed.length,
      paymentsCreatedNotCompleted: created.length,
      revenueRupees,
      refundedRupees,
      netRevenueRupees: revenueRupees - refundedRupees,
    };
  },
});


/**
 * Admin cleanup: fully remove a user and all auth/profile records by email.
 * Call via: npx convex run admin:deleteUserByEmail '{"email":"x@y.com"}'
 */
export const deleteUserByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const summary: Record<string, number> = {};

    // 1. Find the user
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("email"), normalized))
      .first();

    if (!user) {
      return { found: false, summary, email: normalized };
    }

    const userId = user._id;

    // 2. Delete auth accounts (password credentials)
    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    for (const acc of authAccounts) await ctx.db.delete(acc._id);
    summary.authAccounts = authAccounts.length;

    // 3. Delete auth sessions
    const authSessions = await ctx.db
      .query("authSessions")
      .filter(q => q.eq(q.field("userId"), userId))
      .collect();
    for (const s of authSessions) {
      // Also delete refresh tokens tied to this session
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .filter(q => q.eq(q.field("sessionId"), s._id))
        .collect();
      for (const rt of refreshTokens) await ctx.db.delete(rt._id);
      await ctx.db.delete(s._id);
    }
    summary.authSessions = authSessions.length;

    // 4. Delete verification codes tied to this user's authAccounts
    let verificationCodeCount = 0;
    for (const acc of authAccounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .filter(q => q.eq(q.field("accountId"), acc._id))
        .collect();
      for (const vcode of codes) await ctx.db.delete(vcode._id);
      verificationCodeCount += codes.length;
    }
    summary.authVerificationCodes = verificationCodeCount;

    // 5. Delete profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .unique();
    if (profile) {
      await ctx.db.delete(profile._id);
      summary.profile = 1;
    }

    // 6. Delete meal logs
    const mealLogs = await ctx.db
      .query("mealLogs")
      .withIndex("by_userId_date", q => q.eq("userId", userId))
      .collect();
    for (const m of mealLogs) await ctx.db.delete(m._id);
    summary.mealLogs = mealLogs.length;

    // 7. Delete scan results
    const scanResults = await ctx.db
      .query("scanResults")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .collect();
    for (const s of scanResults) await ctx.db.delete(s._id);
    summary.scanResults = scanResults.length;

    // 8. Delete chat messages
    const chatMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .collect();
    for (const c of chatMessages) await ctx.db.delete(c._id);
    summary.chatMessages = chatMessages.length;

    // 9. Delete family menus
    const familyMenus = await ctx.db
      .query("familyMenus")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .collect();
    for (const f of familyMenus) await ctx.db.delete(f._id);
    summary.familyMenus = familyMenus.length;

    // 10. Delete lab results
    const labResults = await ctx.db
      .query("labResults")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .collect();
    for (const l of labResults) await ctx.db.delete(l._id);
    summary.labResults = labResults.length;

    // 11a. Delete nudge events
    const nudgeEvents = await ctx.db
      .query("nudgeEvents")
      .withIndex("by_userId_createdAt", q => q.eq("userId", userId))
      .collect();
    for (const e of nudgeEvents) await ctx.db.delete(e._id);
    summary.nudgeEvents = nudgeEvents.length;

    // 11b. Delete notifications
    const notifs = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", q => q.eq("userId", userId))
      .collect();
    for (const n of notifs) await ctx.db.delete(n._id);
    summary.notifications = notifs.length;

    // 11. Delete waitlist entry (if present)
    const waitlist = await ctx.db
      .query("waitlist")
      .filter(q => q.eq(q.field("email"), normalized))
      .collect();
    for (const w of waitlist) await ctx.db.delete(w._id);
    summary.waitlist = waitlist.length;

    // 12. Finally delete the user
    await ctx.db.delete(userId);
    summary.user = 1;

    return { found: true, userId, email: normalized, summary };
  },
});

/**
 * Revive nudgeEvents that were skipped with reason "quiet" so the worker
 * picks them up on the next tick. Use after widening the quiet-hours window.
 * Skips events older than 4h (the worker would mark them stale anyway).
 */
export const reviveQuietSkippedEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 4 * 3600 * 1000;
    const events = await ctx.db
      .query("nudgeEvents")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "skipped"))
      .collect();
    const reviveable = events.filter(
      (e) => e.skipReason === "quiet" && e.createdAt >= cutoff,
    );
    for (const e of reviveable) {
      await ctx.db.patch(e._id, {
        status: "pending",
        skipReason: undefined,
        processedAt: undefined,
      });
    }
    return { revived: reviveable.length };
  },
});

/**
 * Find profiles sharing the same Telegram chatId. Used to clean up
 * after the legacy completeConnect bug that allowed the same chat to
 * be bound to multiple profiles. Returns a list — call
 * `unbindTelegramFromProfile` for each duplicate you want to clear.
 */
export const findDuplicateTelegramConnections = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    const byChat: Record<string, { profileId: string; userId: string }[]> = {};
    for (const p of profiles) {
      if (!p.telegramChatId) continue;
      const list = (byChat[p.telegramChatId] = byChat[p.telegramChatId] ?? []);
      list.push({ profileId: p._id, userId: p.userId });
    }
    const dupes = Object.entries(byChat).filter(([, list]) => list.length > 1);
    return dupes.map(([chatId, list]) => ({ chatId, profiles: list }));
  },
});

export const unbindTelegramFromProfile = internalMutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    await ctx.db.patch(profileId, {
      telegramChatId: undefined,
      telegramOptIn: false,
      telegramVerifiedAt: undefined,
    });
    return { ok: true };
  },
});

/**
 * Mark a user as comp'd lifetime ("beta" reason — does NOT count toward
 * the 50 founder cap). Use for admins, internal testers, and anyone you
 * want to give unlimited access to without going through Razorpay.
 *
 * Usage:
 *   CONVEX_DEPLOYMENT=prod:coordinated-corgi-211 \
 *     npx convex run admin:grantBetaLifetime '{"email":"x@y.com"}'
 */
export const grantBetaLifetime = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), normalized))
      .first();
    if (!user) {
      return { ok: false as const, reason: "no-user" as const, email: normalized };
    }
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile) {
      return { ok: false as const, reason: "no-profile" as const, userId: user._id };
    }
    await ctx.db.patch(profile._id, {
      plan: "lifetime",
      lifetimeReason: "beta",
      paidAt: profile.paidAt ?? Date.now(),
      tokensUsedThisMonth: 0,
      usageResetAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return {
      ok: true as const,
      userId: user._id,
      profileId: profile._id,
      email: normalized,
    };
  },
});

/**
 * One-shot fix for the two seed templates that had unfillable placeholders
 * ({totalCal}, {recapNote}, {avgCal}). Replaces them with placeholder-free
 * copy that reads cleanly even when the AI rewriter falls back.
 *
 * Idempotent — safe to re-run.
 */
export const fixLeakyTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const updates = [
      {
        variant: "dr-v1",
        template: "{name}, day's a wrap. Tomorrow, lead with protein at breakfast — sets the tone.",
      },
      {
        variant: "wr-v1",
        template: "Week wrapped, {name}. Fresh sheet tomorrow. One small change: protein at breakfast every day this week.",
      },
    ];
    let fixed = 0;
    for (const u of updates) {
      const existing = await ctx.db
        .query("nudgeTemplates")
        .filter((q) => q.eq(q.field("variant"), u.variant))
        .collect();
      for (const row of existing) {
        await ctx.db.patch(row._id, { template: u.template });
        fixed++;
      }
    }
    return { fixed };
  },
});

/**
 * Delete notifications that have an unfilled {placeholder} in their
 * message — these are AI-fallback failures that shouldn't have shipped.
 * Returns how many were deleted.
 */
export const cleanupBrokenNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("notifications").collect();
    const broken = all.filter((n) => /\{[a-zA-Z]\w*\}/.test(n.message));
    for (const n of broken) await ctx.db.delete(n._id);
    return { deleted: broken.length };
  },
});

/**
 * Manually kick the worker once — useful right after revive.
 */
export const runWorkerOnce = internalAction({
  args: {},
  handler: async (ctx) => {
    const result: { processed: number; total: number; reason?: string } =
      await ctx.runAction(internal.nudges.worker.processNudgeQueue, {});
    return result;
  },
});
