import { Doc } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

// Token auth is a plain function argument checked against the `memberships`
// table — deliberately NOT Convex's built-in identity/auth system.
// Returns the membership the token belongs to, or throws if the token is
// unknown. Throwing surfaces as a non-2xx over the HTTP API, which is what the
// shared contract tells callers to treat as failure.
export async function requireMembership(
  ctx: QueryCtx,
  token: string,
): Promise<Doc<"memberships">> {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (membership === null) {
    throw new Error("invalid token");
  }
  return membership;
}
