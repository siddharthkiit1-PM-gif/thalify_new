import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ThalifyPasswordReset } from "./passwordReset";

// Session lifetimes:
//   totalDurationMs    — absolute max (logout after this regardless of activity)
//   inactiveDurationMs — sliding window (logout after this of no use; refreshes on activity)
// Both 10 days — explicit choice. Long enough that returning users don't keep
// re-logging in, short enough that an idle device logs out in reasonable time.
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: ThalifyPasswordReset,
      profile(params) {
        const email = params.email as string;
        const rawName = params.name as string | undefined;
        const result: Record<string, string> = { email };
        if (rawName && rawName.trim().length > 0) {
          result.name = rawName.trim();
        }
        return result as { email: string };
      },
    }),
  ],
  session: {
    totalDurationMs: TEN_DAYS_MS,
    inactiveDurationMs: TEN_DAYS_MS,
  },
});
