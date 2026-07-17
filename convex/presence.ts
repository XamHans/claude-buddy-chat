import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMembership } from "./auth";

// Timestamps are Unix seconds, consistent with message `time` (CONTRACT.md §4).
const nowSeconds = () => Math.floor(Date.now() / 1000);

// Sets the caller's own online/offline state (authenticated by token).
export const setPresence = mutation({
  args: {
    token: v.string(),
    online: v.boolean(),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const membership = await requireMembership(ctx, args.token);
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_membership", (q) =>
        q.eq("membershipId", membership._id),
      )
      .unique();
    if (presence === null) {
      // Defensive: every membership gets a presence row at mint time.
      await ctx.db.insert("presence", {
        membershipId: membership._id,
        room: membership.room,
        personName: membership.personName,
        online: args.online,
        lastSeen: nowSeconds(),
      });
    } else {
      await ctx.db.patch(presence._id, {
        online: args.online,
        lastSeen: nowSeconds(),
      });
    }
    return { ok: true as const };
  },
});

// Lists presence for every membership in the caller's room.
export const listPresence = query({
  args: {
    token: v.string(),
  },
  returns: v.object({
    memberships: v.array(
      v.object({
        room: v.string(),
        personName: v.string(),
        online: v.boolean(),
        lastSeen: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const membership = await requireMembership(ctx, args.token);
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_room", (q) => q.eq("room", membership.room))
      .collect();
    return {
      memberships: rows.map((r) => ({
        room: r.room,
        personName: r.personName,
        online: r.online,
        lastSeen: r.lastSeen,
      })),
    };
  },
});
