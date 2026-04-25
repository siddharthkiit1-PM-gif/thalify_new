/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as __fixtures___nudges from "../__fixtures__/nudges.js";
import type * as accountEmails from "../accountEmails.js";
import type * as admin from "../admin.js";
import type * as adminScans from "../adminScans.js";
import type * as ai_claude from "../ai/claude.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as data_foodMatcher from "../data/foodMatcher.js";
import type * as data_indianFoods from "../data/indianFoods.js";
import type * as email from "../email.js";
import type * as family from "../family.js";
import type * as http from "../http.js";
import type * as lab from "../lab.js";
import type * as lib_calorie from "../lib/calorie.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_security from "../lib/security.js";
import type * as lib_tiers from "../lib/tiers.js";
import type * as meals from "../meals.js";
import type * as nudges_aiWriter from "../nudges/aiWriter.js";
import type * as nudges_gatekeepers from "../nudges/gatekeepers.js";
import type * as nudges_queue from "../nudges/queue.js";
import type * as nudges_rules from "../nudges/rules.js";
import type * as nudges_signal from "../nudges/signal.js";
import type * as nudges_templatePicker from "../nudges/templatePicker.js";
import type * as nudges_worker from "../nudges/worker.js";
import type * as passwordReset from "../passwordReset.js";
import type * as patterns from "../patterns.js";
import type * as scan from "../scan.js";
import type * as scanFeedback from "../scanFeedback.js";
import type * as storage from "../storage.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "__fixtures__/nudges": typeof __fixtures___nudges;
  accountEmails: typeof accountEmails;
  admin: typeof admin;
  adminScans: typeof adminScans;
  "ai/claude": typeof ai_claude;
  auth: typeof auth;
  chat: typeof chat;
  "data/foodMatcher": typeof data_foodMatcher;
  "data/indianFoods": typeof data_indianFoods;
  email: typeof email;
  family: typeof family;
  http: typeof http;
  lab: typeof lab;
  "lib/calorie": typeof lib_calorie;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/security": typeof lib_security;
  "lib/tiers": typeof lib_tiers;
  meals: typeof meals;
  "nudges/aiWriter": typeof nudges_aiWriter;
  "nudges/gatekeepers": typeof nudges_gatekeepers;
  "nudges/queue": typeof nudges_queue;
  "nudges/rules": typeof nudges_rules;
  "nudges/signal": typeof nudges_signal;
  "nudges/templatePicker": typeof nudges_templatePicker;
  "nudges/worker": typeof nudges_worker;
  passwordReset: typeof passwordReset;
  patterns: typeof patterns;
  scan: typeof scan;
  scanFeedback: typeof scanFeedback;
  storage: typeof storage;
  users: typeof users;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
