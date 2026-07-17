import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Owner-only: mints a fresh token for a person in a room and creates the
// membership + an initial (offline) presence row. `adminKey` is a separate,
// higher-privilege secret compared against the ADMIN_KEY environment variable
// set on the deployment — it is never handed to friends.
export const mintToken = mutation({
  args: {
    adminKey: v.string(),
    room: v.string(),
    personName: v.string(),
  },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    const expected = process.env.ADMIN_KEY;
    if (!expected) {
      throw new Error("ADMIN_KEY is not configured on the deployment");
    }
    if (args.adminKey !== expected) {
      throw new Error("unauthorized");
    }

    // Record the room as a first-class entity the first time we see it.
    const existingRoom = await ctx.db
      .query("rooms")
      .withIndex("by_name", (q) => q.eq("name", args.room))
      .unique();
    if (existingRoom === null) {
      await ctx.db.insert("rooms", { name: args.room });
    }

    const token = "tok_" + crypto.randomUUID().replace(/-/g, "");

    const membershipId = await ctx.db.insert("memberships", {
      room: args.room,
      personName: args.personName,
      token,
    });

    await ctx.db.insert("presence", {
      membershipId,
      room: args.room,
      personName: args.personName,
      online: false,
      lastSeen: Math.floor(Date.now() / 1000),
    });

    return { token };
  },
});
