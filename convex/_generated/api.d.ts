/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountEmails from "../accountEmails.js";
import type * as ai_claude from "../ai/claude.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as data_foodMatcher from "../data/foodMatcher.js";
import type * as data_indianFoods from "../data/indianFoods.js";
import type * as email from "../email.js";
import type * as family from "../family.js";
import type * as http from "../http.js";
import type * as lab from "../lab.js";
import type * as meals from "../meals.js";
import type * as patterns from "../patterns.js";
import type * as scan from "../scan.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountEmails: typeof accountEmails;
  "ai/claude": typeof ai_claude;
  auth: typeof auth;
  chat: typeof chat;
  "data/foodMatcher": typeof data_foodMatcher;
  "data/indianFoods": typeof data_indianFoods;
  email: typeof email;
  family: typeof family;
  http: typeof http;
  lab: typeof lab;
  meals: typeof meals;
  patterns: typeof patterns;
  scan: typeof scan;
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
