import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process nudge queue",
  { seconds: 60 },
  internal.nudges.worker.processNudgeQueue,
);

crons.cron(
  "seed breakfast checks",
  "30 3 * * *",
  internal.nudges.timeSeeders.seedBreakfastChecks,
);
crons.cron(
  "seed lunch checks",
  "30 7 * * *",
  internal.nudges.timeSeeders.seedLunchChecks,
);
crons.cron(
  "seed dinner checks",
  "30 14 * * *",
  internal.nudges.timeSeeders.seedDinnerChecks,
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
