import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ThalifyPasswordReset } from "./passwordReset";

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
});
