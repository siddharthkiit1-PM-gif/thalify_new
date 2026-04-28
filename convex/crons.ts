import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process nudge queue",
  { seconds: 60 },
  internal.nudges.worker.processNudgeQueue,
);

// One single daily ask: "have you logged today?" — fires only if the user
// hasn't logged anything yet that day. Replaces the earlier breakfast/lunch/
// dinner-skipped triple-cron, which was too noisy. 8 PM IST = 14:30 UTC.
crons.cron(
  "seed daily log prompt",
  "30 14 * * *",
  internal.nudges.timeSeeders.seedDailyLogPrompt,
);

// Anti-churn: users with a 3+ day silence streak get a weight/goal-aware
// re-engagement nudge once per day. 6 PM IST = 12:30 UTC.
crons.cron(
  "seed re-engagement",
  "30 12 * * *",
  internal.nudges.signalSeeders.seedReEngagement,
);

// Personal-intelligence layer: if the same food shows up in 4+ of the last 7
// days, suggest one variety swap. 11 AM IST = 5:30 UTC, lined up with lunch
// planning so the suggestion lands in time to act on.
crons.cron(
  "seed food repetition",
  "30 5 * * *",
  internal.nudges.signalSeeders.seedFoodRepetition,
);

crons.cron(
  "seed daily summaries",
  "0 16 * * *",
  internal.nudges.timeSeeders.seedDailySummaries,
);
crons.cron(
  "seed weekly insights",
  "30 4 * * 0",
  internal.nudges.timeSeeders.seedWeeklyInsights,
);

export default crons;
