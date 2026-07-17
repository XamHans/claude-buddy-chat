import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMembership } from "./auth";

const MAX_MESSAGES = 200;

// Timestamps are Unix seconds, matching the local history-cache format pinned
// in CONTRACT.md section 4 (e.g. `"time": 1784291334`) — slice 03 caches these
// values verbatim.
const nowSeconds = () => Math.floor(Date.now() / 1000);

// Appends a message to a room (authenticated by token). The token must belong
// to the room being posted to — you can only write to your own room.
export const sendMessage = mutation({
  args: {
    token: v.string(),
    room: v.string(),
    text: v.string(),
  },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const membership = await requireMembership(ctx, args.token);
    if (membership.room !== args.room) {
      throw new Error("token does not belong to this room");
    }
    await ctx.db.insert("messages", {
      room: args.room,
      personName: membership.personName,
      text: args.text,
      time: nowSeconds(),
    });
    return { ok: true as const };
  },
});

// Returns a room's message history in chronological order (oldest first).
// The token must belong to the room. `since` (a millisecond timestamp) returns
// only messages strictly newer than it, for cheap polling.
export const listMessages = query({
  args: {
    token: v.string(),
    room: v.string(),
    since: v.optional(v.number()),
  },
  returns: v.object({
    messages: v.array(
      v.object({
        personName: v.string(),
        text: v.string(),
        time: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const membership = await requireMembership(ctx, args.token);
    if (membership.room !== args.room) {
      throw new Error("token does not belong to this room");
    }

    const since = args.since;
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_room_time", (q) => {
        const base = q.eq("room", args.room);
        return since === undefined ? base : base.gt("time", since);
      })
      .order("desc")
      .take(MAX_MESSAGES);

    // `.order("desc").take()` gives the newest N; return them oldest-first.
    rows.reverse();
    return {
      messages: rows.map((r) => ({
        personName: r.personName,
        text: r.text,
        time: r.time,
      })),
    };
  },
});
