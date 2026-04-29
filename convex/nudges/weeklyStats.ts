/**
 * Weekly meal-log aggregates used to ground the Sunday recap nudge in
 * actual numbers (days logged, avg cal, protein gap, top foods, best
 * + worst day) instead of a generic template rewrite.
 *
 * Called by the worker when processing a weekly_insight event; the
 * shape is consumed by aiWriter's WEEKLY_RECAP_SYSTEM_PROMPT.
 */

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

const WEEK_DAYS = 7;
const PROTEIN_GOAL_DEFAULT = 90;

export type WeeklyStats = {
  daysLogged: number;
  totalDays: number;
  calorieGoal: number;
  proteinGoal: number;
  avgCalPerLoggedDay: number;
  avgProteinPerLoggedDay: number;
  daysUnderTarget: number;
  daysOnTarget: number;
  daysOverTarget: number;
  totalMeals: number;
  topFoods: { name: string; count: number }[];
  bestDay: { date: string; totalCal: number } | null;
  worstDay: { date: string; totalCal: number; over: number } | null;
};

function dateAtDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().split("T")[0];
}

export const getWeeklyStatsForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<WeeklyStats> => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const calorieGoal = profile?.calorieGoal ?? 1800;

    const sinceDate = dateAtDaysAgo(WEEK_DAYS);

    const logs = await ctx.db
      .query("mealLogs")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .collect();
    const weekLogs = logs.filter((l) => l.date >= sinceDate);

    const empty: WeeklyStats = {
      daysLogged: 0,
      totalDays: WEEK_DAYS,
      calorieGoal,
      proteinGoal: PROTEIN_GOAL_DEFAULT,
      avgCalPerLoggedDay: 0,
      avgProteinPerLoggedDay: 0,
      daysUnderTarget: 0,
      daysOnTarget: 0,
      daysOverTarget: 0,
      totalMeals: 0,
      topFoods: [],
      bestDay: null,
      worstDay: null,
    };
    if (weekLogs.length === 0) return empty;

    // Group by date — one row per logged day.
    const byDate = new Map<string, { totalCal: number; totalProtein: number }>();
    const foodCount = new Map<string, { display: string; count: number }>();

    for (const log of weekLogs) {
      const day = byDate.get(log.date) ?? { totalCal: 0, totalProtein: 0 };
      day.totalCal += log.totalCal;
      day.totalProtein += log.items.reduce((a, i) => a + (i.protein ?? 0), 0);
      byDate.set(log.date, day);

      for (const it of log.items) {
        const key = it.name.toLowerCase().trim();
        if (!key) continue;
        const ex = foodCount.get(key);
        if (ex) ex.count++;
        else foodCount.set(key, { display: it.name, count: 1 });
      }
    }

    const daysLogged = byDate.size;
    let totalCal = 0;
    let totalProtein = 0;
    let daysUnder = 0;
    let daysOn = 0;
    let daysOver = 0;
    let bestDay: WeeklyStats["bestDay"] = null;
    let worstDay: WeeklyStats["worstDay"] = null;
    let bestDist = Infinity;
    let worstOver = -Infinity;

    for (const [date, d] of byDate.entries()) {
      totalCal += d.totalCal;
      totalProtein += d.totalProtein;
      const distFromGoal = d.totalCal - calorieGoal;
      const tolerance = Math.max(80, calorieGoal * 0.05); // ±5% counts as "on target"
      if (distFromGoal < -tolerance) daysUnder++;
      else if (distFromGoal > tolerance) daysOver++;
      else daysOn++;

      // Best day = closest to goal
      const absDist = Math.abs(distFromGoal);
      if (absDist < bestDist) { bestDist = absDist; bestDay = { date, totalCal: d.totalCal }; }
      // Worst day = most over goal
      if (distFromGoal > worstOver) {
        worstOver = distFromGoal;
        worstDay = { date, totalCal: d.totalCal, over: distFromGoal };
      }
    }

    const topFoods = [...foodCount.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((f) => ({ name: f.display, count: f.count }));

    return {
      daysLogged,
      totalDays: WEEK_DAYS,
      calorieGoal,
      proteinGoal: PROTEIN_GOAL_DEFAULT,
      avgCalPerLoggedDay: Math.round(totalCal / daysLogged),
      avgProteinPerLoggedDay: Math.round(totalProtein / daysLogged),
      daysUnderTarget: daysUnder,
      daysOnTarget: daysOn,
      daysOverTarget: daysOver,
      totalMeals: weekLogs.length,
      topFoods,
      bestDay,
      worstDay: worstDay && worstDay.over > 0 ? worstDay : null,
    };
  },
});
