/**
 * Plan-based usage quota for paywall enforcement.
 *
 * Two tiers today (subscription tier coming later):
 *   - "free"     — small per-action monthly limits (5 scans, 10 chats, etc.)
 *   - "lifetime" — single bucket of 3000 actions/month (any type counts as 1)
 *
 * Both reset every 30 days from first use. Resets happen lazily — first
 * action after `usageResetAt` zeroes everything and bumps the timestamp.
 *
 * Currently called in SOFT mode by the actions: counters increment on
 * every action so we accumulate real usage data, but limits aren't yet
 * enforced. Flip the kill switch via the QUOTA_ENFORCEMENT env var when
 * we're ready for the paywall to actually block requests.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

export type ActionType = "scan" | "chat" | "lab" | "family" | "pattern";

// Free tier: per-action monthly caps
const FREE_LIMITS: Record<ActionType, number> = {
  scan: 5,
  chat: 10,
  lab: 1,
  family: 2,
  pattern: 1,
};

// Lifetime tier: single shared bucket
export const LIFETIME_MONTHLY_TOKENS = 3000;

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const FIELD_BY_TYPE: Record<ActionType, keyof Doc<"profiles">> = {
  scan: "freeScansUsedThisMonth",
  chat: "freeChatsUsedThisMonth",
  lab: "freeLabsUsedThisMonth",
  family: "freeFamilyUsedThisMonth",
  pattern: "freePatternsUsedThisMonth",
};

export class QuotaExceededError extends Error {
  code = "quota_exceeded" as const;
  actionType: ActionType;
  plan: "free" | "lifetime";
  used: number;
  limit: number;
  constructor(
    actionType: ActionType,
    plan: "free" | "lifetime",
    used: number,
    limit: number,
  ) {
    super(
      plan === "free"
        ? `Free tier ${actionType} limit reached (${used}/${limit} this month). Upgrade for lifetime access.`
        : `Monthly action limit reached (${used}/${limit}). Resets next billing cycle.`,
    );
    this.actionType = actionType;
    this.plan = plan;
    this.used = used;
    this.limit = limit;
  }
}

/**
 * Check + increment quota for the given action.
 * - Lazy resets the monthly counters if past usageResetAt.
 * - Throws QuotaExceededError if over the cap (only when ENFORCED).
 * - Always increments the counter so we get usage data even in soft mode.
 *
 * Pass enforce=false (default) for soft tracking. Set to true once paywall ships.
 */
export async function enforceUserQuota(
  ctx: GenericMutationCtx<DataModel>,
  userId: Id<"users">,
  actionType: ActionType,
  opts: { enforce?: boolean } = {},
): Promise<void> {
  const enforce = opts.enforce ?? false;

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) {
    // No profile = onboarding incomplete; let the action's own checks handle it.
    return;
  }

  const now = Date.now();
  const plan: "free" | "lifetime" = profile.plan ?? "free";

  // 1. Lazy reset if past the reset window
  let resetAt = profile.usageResetAt ?? 0;
  let needsReset = false;
  if (resetAt === 0 || resetAt < now) {
    resetAt = now + MONTH_MS;
    needsReset = true;
  }

  if (plan === "lifetime") {
    const used = needsReset ? 0 : (profile.tokensUsedThisMonth ?? 0);
    if (enforce && used >= LIFETIME_MONTHLY_TOKENS) {
      throw new QuotaExceededError(actionType, "lifetime", used, LIFETIME_MONTHLY_TOKENS);
    }
    await ctx.db.patch(profile._id, {
      tokensUsedThisMonth: used + 1,
      usageResetAt: resetAt,
    });
    return;
  }

  // Free tier — per-action caps
  const field = FIELD_BY_TYPE[actionType];
  const used = needsReset ? 0 : ((profile[field] as number | undefined) ?? 0);
  const limit = FREE_LIMITS[actionType];

  if (enforce && used >= limit) {
    throw new QuotaExceededError(actionType, "free", used, limit);
  }

  // Increment + reset together
  const patch: Partial<Doc<"profiles">> = {
    [field]: used + 1,
    usageResetAt: resetAt,
  };
  if (needsReset) {
    // Wipe other counters too so we start the new month clean
    for (const t of Object.keys(FIELD_BY_TYPE) as ActionType[]) {
      if (t !== actionType) {
        const f = FIELD_BY_TYPE[t];
        (patch as Record<string, unknown>)[f] = 0;
      }
    }
    patch.tokensUsedThisMonth = 0;
  }
  await ctx.db.patch(profile._id, patch);
}

/**
 * Read-only view of the user's current quota — used by the frontend account
 * page to render "3 of 5 scans used this month" etc.
 */
export async function getUserQuotaStatus(
  ctx: { db: GenericMutationCtx<DataModel>["db"] },
  userId: Id<"users">,
): Promise<{
  plan: "free" | "lifetime";
  founderNumber: number | null;
  resetsAt: number | null;
  free: Record<ActionType, { used: number; limit: number }>;
  lifetime: { used: number; limit: number };
} | null> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) return null;

  const plan = profile.plan ?? "free";
  const free = (Object.keys(FIELD_BY_TYPE) as ActionType[]).reduce(
    (acc, t) => {
      acc[t] = {
        used: (profile[FIELD_BY_TYPE[t]] as number | undefined) ?? 0,
        limit: FREE_LIMITS[t],
      };
      return acc;
    },
    {} as Record<ActionType, { used: number; limit: number }>,
  );

  return {
    plan,
    founderNumber: profile.founderNumber ?? null,
    resetsAt: profile.usageResetAt ?? null,
    free,
    lifetime: {
      used: profile.tokensUsedThisMonth ?? 0,
      limit: LIFETIME_MONTHLY_TOKENS,
    },
  };
}
