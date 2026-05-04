import { internalMutation, internalAction, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Single-email admin gate for personal-stats endpoints. */
const PERSONAL_ADMIN_EMAIL = "agrawalsiddharth66@gmail.com";

/**
 * One-shot: update the daily-log-prompt template copy to the newer
 * "have you eaten?" inquisitive tone. Re-seeding doesn't touch existing
 * variants (idempotent by `variant`), so we patch them by hand here.
 *
 * Call: npx convex run admin:updateDailyLogPromptCopy --prod
 */
export const updateDailyLogPromptCopy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const updates: { variant: string; template: string }[] = [
      { variant: "dlp-v1", template: "Hey {name}, have you eaten today? I haven't seen anything logged yet. Snap a photo of whatever you had — even chai counts." },
      { variant: "dlp-v2", template: "{name}, quick check — busy day or just forgot to log? If you ate, click a photo and send it. If not, tell me and we'll figure something easy out." },
      { variant: "dlp-v3", template: "{name}, no meals logged yet today. Photo of whatever you ate (or are about to) gets you back on track in 20 seconds." },
    ];
    let updated = 0;
    for (const u of updates) {
      const row = await ctx.db
        .query("nudgeTemplates")
        .filter((q) => q.eq(q.field("variant"), u.variant))
        .first();
      if (row && row.template !== u.template) {
        await ctx.db.patch(row._id, { template: u.template });
        updated++;
      }
    }
    return { updated, total: updates.length };
  },
});

/**
 * AUTH-DRIVEN funnel — uses Convex Auth's authSessions table to classify
 * users by actual app session activity, not meal-log activity.
 *
 * Definitions:
 *   - Total signups   = every row in `users`
 *   - Ever signed in  = users with ≥1 row in authSessions (almost all,
 *                       since signup auto-creates a session)
 *   - Active 7 days   = users with at least 1 authSessions row whose
 *                       _creationTime is in the last 7 days
 *   - Active 30 days  = same, but 30-day window
 *   - Dormant         = signed up + never came back. Defined as: NOT
 *                       active in last 30 days AND session count ≤ 1
 *                       (i.e. they only ever had the auto-signup session)
 *
 * Returns per-user rows sorted newest signup first.
 *
 * Call: npx convex run admin:authFunnelInternal --prod
 */
export const authFunnelInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 3600 * 1000;
    const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

    const users = await ctx.db.query("users").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const sessions = await ctx.db.query("authSessions").collect();
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

    // Aggregate sessions per user
    type Agg = { count: number; latest: number; earliest: number };
    const sessionAgg = new Map<string, Agg>();
    for (const s of sessions) {
      const uid = s.userId as string;
      const t = s._creationTime;
      const a = sessionAgg.get(uid);
      if (a) {
        a.count++;
        if (t > a.latest) a.latest = t;
        if (t < a.earliest) a.earliest = t;
      } else {
        sessionAgg.set(uid, { count: 1, latest: t, earliest: t });
      }
    }

    const rows = users.map((u) => {
      const a = sessionAgg.get(u._id);
      const profile = profileByUser.get(u._id);
      const sessionsCount = a?.count ?? 0;
      const lastSessionAt = a?.latest ?? null;
      const ageMs = lastSessionAt ? now - lastSessionAt : null;
      const isActive7d = ageMs !== null && ageMs <= SEVEN_DAYS;
      const isActive30d = ageMs !== null && ageMs <= THIRTY_DAYS;
      // Dormant = never came back. Only had the auto-signup session and
      // hasn't been active in 30 days.
      const isDormant = !isActive30d && sessionsCount <= 1;
      // Status label
      let status: "active-7d" | "active-30d" | "dormant" | "lapsed" = "lapsed";
      if (isActive7d) status = "active-7d";
      else if (isActive30d) status = "active-30d";
      else if (isDormant) status = "dormant";

      return {
        email: u.email ?? "(no email)",
        name: u.name ?? "(no name)",
        signedUpAt: u._creationTime,
        sessionsCount,
        lastSessionAt,
        daysSinceLastSession: ageMs !== null ? Math.floor(ageMs / (24 * 3600 * 1000)) : null,
        status,
        plan: profile?.plan ?? "free",
        onboardingComplete: profile?.onboardingComplete === true,
        telegramConnected: profile?.telegramOptIn === true,
      };
    }).sort((a, b) => b.signedUpAt - a.signedUpAt);

    return {
      summary: {
        totalSignups: rows.length,
        everSignedIn: rows.filter((r) => r.sessionsCount > 0).length,
        activeLast7Days: rows.filter((r) => r.status === "active-7d").length,
        activeLast30Days: rows.filter((r) => r.status === "active-7d" || r.status === "active-30d").length,
        dormant: rows.filter((r) => r.status === "dormant").length,
        lapsed: rows.filter((r) => r.status === "lapsed").length,
      },
      users: rows,
    };
  },
});

/**
 * Public-query version of authFunnelInternal — admin-gated to
 * agrawalsiddharth66@gmail.com so the new /admin section can render
 * the data with reactive updates.
 */
export const authFunnel = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const me = await ctx.db.get(userId);
    if (!me || me.email !== PERSONAL_ADMIN_EMAIL) return null;

    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 3600 * 1000;
    const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

    const users = await ctx.db.query("users").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const sessions = await ctx.db.query("authSessions").collect();
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

    type Agg = { count: number; latest: number };
    const sessionAgg = new Map<string, Agg>();
    for (const s of sessions) {
      const uid = s.userId as string;
      const t = s._creationTime;
      const a = sessionAgg.get(uid);
      if (a) {
        a.count++;
        if (t > a.latest) a.latest = t;
      } else {
        sessionAgg.set(uid, { count: 1, latest: t });
      }
    }

    const rows = users.map((u) => {
      const a = sessionAgg.get(u._id);
      const profile = profileByUser.get(u._id);
      const sessionsCount = a?.count ?? 0;
      const lastSessionAt = a?.latest ?? null;
      const ageMs = lastSessionAt ? now - lastSessionAt : null;
      const isActive7d = ageMs !== null && ageMs <= SEVEN_DAYS;
      const isActive30d = ageMs !== null && ageMs <= THIRTY_DAYS;
      const isDormant = !isActive30d && sessionsCount <= 1;
      let status: "active-7d" | "active-30d" | "dormant" | "lapsed" = "lapsed";
      if (isActive7d) status = "active-7d";
      else if (isActive30d) status = "active-30d";
      else if (isDormant) status = "dormant";
      return {
        email: u.email ?? "(no email)",
        name: u.name ?? "(no name)",
        signedUpAt: u._creationTime,
        sessionsCount,
        lastSessionAt,
        daysSinceLastSession: ageMs !== null ? Math.floor(ageMs / (24 * 3600 * 1000)) : null,
        status,
        plan: profile?.plan ?? "free",
        onboardingComplete: profile?.onboardingComplete === true,
        telegramConnected: profile?.telegramOptIn === true,
      };
    }).sort((a, b) => b.signedUpAt - a.signedUpAt);

    return {
      summary: {
        totalSignups: rows.length,
        everSignedIn: rows.filter((r) => r.sessionsCount > 0).length,
        activeLast7Days: rows.filter((r) => r.status === "active-7d").length,
        activeLast30Days: rows.filter((r) => r.status === "active-7d" || r.status === "active-30d").length,
        dormant: rows.filter((r) => r.status === "dormant").length,
        lapsed: rows.filter((r) => r.status === "lapsed").length,
      },
      users: rows,
    };
  },
});

/**
 * Recent meal logs across ALL users — for admin to see who logged what.
 * Joins mealLogs with users so each row has the person's name + email
 * inline (no need to cross-reference userIds in the data tab).
 *
 * Call: npx convex run admin:recentMealLogsAcrossUsers --prod '{"limit":50}'
 */
export const recentMealLogsAcrossUsers = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 100 }) => {
    const logs = await ctx.db
      .query("mealLogs")
      .order("desc")
      .take(limit);

    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userMap = new Map(
      users.filter((u): u is NonNullable<typeof u> => u !== null).map((u) => [u._id, u]),
    );

    return logs.map((l) => {
      const u = userMap.get(l.userId);
      return {
        time: new Date(l._creationTime).toISOString(),
        date: l.date,
        userName: u?.name ?? "(unknown)",
        userEmail: u?.email ?? "(no email)",
        mealType: l.mealType,
        items: l.items.map((i) => i.name),
        totalCal: l.totalCal,
      };
    });
  },
});

/**
 * Funnel view: every user with their activity state. Useful for spotting
 * sign-up-but-never-came-back drop-offs.
 *
 * Returns one row per user, newest signup first, with:
 *   email, name, signupAt, onboardingComplete, plan, mealLogCount,
 *   scanCount, lastMealAt, telegramConnected, daysSinceLastMeal.
 *
 * Admin-gated to agrawalsiddharth66@gmail.com via the public version below.
 * CLI version skips the gate (CLI access is the gate).
 *
 * Call: npx convex run admin:listUsersFunnelInternal --prod
 */
export const listUsersFunnelInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

    const allLogs = await ctx.db.query("mealLogs").collect();
    const mealCountByUser = new Map<string, number>();
    const lastMealByUser = new Map<string, number>();
    for (const log of allLogs) {
      mealCountByUser.set(log.userId, (mealCountByUser.get(log.userId) ?? 0) + 1);
      const prev = lastMealByUser.get(log.userId) ?? 0;
      if (log._creationTime > prev) lastMealByUser.set(log.userId, log._creationTime);
    }

    const allScans = await ctx.db.query("scanResults").collect();
    const scanCountByUser = new Map<string, number>();
    for (const s of allScans) {
      scanCountByUser.set(s.userId, (scanCountByUser.get(s.userId) ?? 0) + 1);
    }

    const now = Date.now();

    const rows = users
      .map((u) => {
        const p = profileByUser.get(u._id);
        const lastMealAt = lastMealByUser.get(u._id);
        const meals = mealCountByUser.get(u._id) ?? 0;
        const scans = scanCountByUser.get(u._id) ?? 0;
        return {
          email: u.email ?? "(no email)",
          name: u.name ?? "(no name)",
          signupAt: new Date(u._creationTime).toISOString(),
          onboardingComplete: p?.onboardingComplete === true,
          plan: p?.plan ?? "free",
          mealLogCount: meals,
          scanCount: scans,
          lastMealAt: lastMealAt ? new Date(lastMealAt).toISOString() : null,
          daysSinceLastMeal: lastMealAt
            ? Math.floor((now - lastMealAt) / (24 * 3600 * 1000))
            : null,
          telegramConnected: p?.telegramOptIn === true,
          // Useful summary flag — true if they signed up but did nothing else
          dormant: meals === 0 && scans === 0,
        };
      })
      .sort((a, b) => (a.signupAt < b.signupAt ? 1 : -1));

    const dormant = rows.filter((r) => r.dormant).length;
    const onboardingIncomplete = rows.filter((r) => !r.onboardingComplete).length;
    const activeAtSomePoint = rows.length - dormant;

    return {
      summary: {
        totalUsers: rows.length,
        dormantSinceSignup: dormant,
        onboardingIncomplete,
        activeAtSomePoint,
      },
      users: rows,
    };
  },
});

/**
 * Public-query version (admin-gated). Same data, callable from a UI later
 * if you want a /admin/users page. Returns null for any caller whose
 * authenticated email isn't agrawalsiddharth66@gmail.com.
 */
export const listUsersFunnel = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const me = await ctx.db.get(userId);
    if (!me || me.email !== PERSONAL_ADMIN_EMAIL) return null;

    const users = await ctx.db.query("users").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

    const allLogs = await ctx.db.query("mealLogs").collect();
    const mealCountByUser = new Map<string, number>();
    const lastMealByUser = new Map<string, number>();
    for (const log of allLogs) {
      mealCountByUser.set(log.userId, (mealCountByUser.get(log.userId) ?? 0) + 1);
      const prev = lastMealByUser.get(log.userId) ?? 0;
      if (log._creationTime > prev) lastMealByUser.set(log.userId, log._creationTime);
    }

    const allScans = await ctx.db.query("scanResults").collect();
    const scanCountByUser = new Map<string, number>();
    for (const s of allScans) {
      scanCountByUser.set(s.userId, (scanCountByUser.get(s.userId) ?? 0) + 1);
    }

    const now = Date.now();
    const rows = users
      .map((u) => {
        const p = profileByUser.get(u._id);
        const lastMealAt = lastMealByUser.get(u._id);
        const meals = mealCountByUser.get(u._id) ?? 0;
        const scans = scanCountByUser.get(u._id) ?? 0;
        return {
          email: u.email ?? "(no email)",
          name: u.name ?? "(no name)",
          signupAt: u._creationTime,
          onboardingComplete: p?.onboardingComplete === true,
          plan: p?.plan ?? "free",
          mealLogCount: meals,
          scanCount: scans,
          lastMealAt: lastMealAt ?? null,
          daysSinceLastMeal: lastMealAt
            ? Math.floor((now - lastMealAt) / (24 * 3600 * 1000))
            : null,
          telegramConnected: p?.telegramOptIn === true,
          dormant: meals === 0 && scans === 0,
        };
      })
      .sort((a, b) => b.signupAt - a.signupAt);

    return {
      summary: {
        totalUsers: rows.length,
        dormantSinceSignup: rows.filter((r) => r.dormant).length,
        onboardingIncomplete: rows.filter((r) => !r.onboardingComplete).length,
        activeAtSomePoint: rows.filter((r) => !r.dormant).length,
      },
      users: rows,
    };
  },
});

/**
 * One-shot: fire a weekly-recap nudge for a specific user immediately —
 * useful for testing the data-driven Sunday insight outside its cron
 * window.
 *
 * Call: npx convex run admin:fireWeeklyRecapForEmail --prod '{"email":"x@y.com"}'
 */
export const fireWeeklyRecapForEmail = internalAction({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ fired: boolean; reason?: string }> => {
    const normalized = email.toLowerCase().trim();
    const userId = await ctx.runQuery(internal.passwordHistory.getUserIdByEmail, {
      email: normalized,
    });
    if (!userId) return { fired: false, reason: "no user with that email" };
    await ctx.runMutation(internal.nudges.queue.enqueue, {
      userId,
      type: "weekly_insight",
    });
    await ctx.runAction(internal.nudges.worker.processNudgeQueue, {});
    return { fired: true };
  },
});

/**
 * One-shot: fire a water-check nudge for a specific user immediately.
 * Useful for testing Telegram delivery without waiting for the 12pm /
 * 6pm IST cron.
 *
 * Call: npx convex run admin:fireWaterCheckForEmail --prod '{"email":"x@y.com"}'
 */
export const fireWaterCheckForEmail = internalAction({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<{ fired: boolean; reason?: string }> => {
    const normalized = email.toLowerCase().trim();
    const userId = await ctx.runQuery(internal.passwordHistory.getUserIdByEmail, {
      email: normalized,
    });
    if (!userId) return { fired: false, reason: "no user with that email" };
    await ctx.runMutation(internal.nudges.queue.enqueue, {
      userId,
      type: "water_check_time",
    });
    // Force-run the worker so the event is processed within seconds, not
    // the next 60-second cron tick.
    await ctx.runAction(internal.nudges.worker.processNudgeQueue, {});
    return { fired: true };
  },
});

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

/**
 * List every lifetime member with the reason they have it (founder vs
 * beta vs waitlist) and whether a Razorpay payment is on file. Lets us
 * answer "did paying customers get a welcome email?" quickly.
 *
 * Call: npx convex run admin:listLifetimeMembersInternal --prod
 */
export const listLifetimeMembersInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").collect();
    const lifetime = profiles.filter((p) => p.plan === "lifetime");
    const out: Array<{
      email: string | null;
      name: string | null;
      lifetimeReason: string | null;
      founderNumber: number | null;
      paidAt: string | null;
      hasRazorpayPayment: boolean;
    }> = [];
    for (const p of lifetime) {
      const user = await ctx.db.get(p.userId);
      out.push({
        email: user?.email ?? null,
        name: user?.name ?? null,
        lifetimeReason: p.lifetimeReason ?? null,
        founderNumber: p.founderNumber ?? null,
        paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
        hasRazorpayPayment: Boolean(p.razorpayPaymentId),
      });
    }
    return out.sort((a, b) => (a.paidAt ?? "") < (b.paidAt ?? "") ? 1 : -1);
  },
});

/**
 * Idempotent backfill: send the founder welcome email to every lifetime
 * member whose `lifetimeReason === "founder"` (i.e. they actually paid).
 * Beta-comp'd users are skipped.
 *
 * Use this after updating welcome-email copy, or to confirm that all
 * paying customers received the welcome message. Pass dryRun:true to
 * preview the recipient list without sending.
 *
 * Call:
 *   npx convex run admin:backfillFounderWelcomeEmail --prod '{"dryRun":true}'
 *   npx convex run admin:backfillFounderWelcomeEmail --prod
 */
export const backfillFounderWelcomeEmail = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun }) => {
    const members: Array<{
      email: string | null;
      name: string | null;
      lifetimeReason: string | null;
      founderNumber: number | null;
      paidAt: string | null;
      hasRazorpayPayment: boolean;
    }> = await ctx.runQuery(internal.admin.listLifetimeMembersInternal, {});

    const founders = members.filter(
      (m) => m.lifetimeReason === "founder" && m.email && m.founderNumber,
    );
    const sent: string[] = [];
    const skipped: Array<{ email: string | null; reason: string }> = [];
    for (const m of members) {
      if (m.lifetimeReason !== "founder") {
        skipped.push({ email: m.email, reason: `not-founder (${m.lifetimeReason ?? "none"})` });
      } else if (!m.email) {
        skipped.push({ email: null, reason: "no-email" });
      } else if (!m.founderNumber) {
        skipped.push({ email: m.email, reason: "no-founder-number" });
      }
    }

    if (dryRun) {
      return {
        dryRun: true,
        wouldSend: founders.map((f) => ({
          email: f.email,
          name: f.name,
          founderNumber: f.founderNumber,
        })),
        skipped,
      };
    }

    for (const f of founders) {
      await ctx.runAction(internal.razorpay.founder.sendFounderWelcomeEmail, {
        userEmail: f.email!,
        userName: f.name ?? undefined,
        founderNumber: f.founderNumber!,
      });
      sent.push(f.email!);
    }
    return { dryRun: false, sent, skipped };
  },
});
