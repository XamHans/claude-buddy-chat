import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Buddy-chat backend schema.
//
// A `room` is identified everywhere by its string slug (e.g. "jonas-room"),
// which is what the shared CONTRACT.md pins as the argument type. The `rooms`
// table records each distinct room as a first-class entity; `memberships`,
// `presence`, and `messages` all reference the room by that slug.
export default defineSchema({
  // One row per friendship/group.
  rooms: defineTable({
    name: v.string(),
  }).index("by_name", ["name"]),

  // One row per person per room. The token is how that person authenticates.
  memberships: defineTable({
    room: v.string(),
    personName: v.string(),
    token: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_room", ["room"]),

  // Latest online/offline state per membership.
  presence: defineTable({
    membershipId: v.id("memberships"),
    room: v.string(),
    personName: v.string(),
    online: v.boolean(),
    lastSeen: v.number(),
  })
    .index("by_membership", ["membershipId"])
    .index("by_room", ["room"]),

  // Durable chat history per room.
  messages: defineTable({
    room: v.string(),
    personName: v.string(),
    text: v.string(),
    time: v.number(),
  }).index("by_room_time", ["room", "time"]),
});
