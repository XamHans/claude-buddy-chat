import { ConvexClient } from "convex/browser";

// Thin wrapper over Convex's reactive client. Function names/args are pinned
// by CONTRACT.md §1; auth is a plain `token` argument, not Convex identity.
export function createConvexClient(url) {
  const client = new ConvexClient(url);
  return {
    raw: client,

    // Reactive subscription: every membership across the caller's rooms.
    // Returns an unsubscribe function.
    onPresence(token, cb) {
      return client.onUpdate(
        "presence:listPresence",
        { token },
        (v) => cb(v.memberships)
      );
    },

    // Reactive subscription: messages for one room. Returns unsubscribe fn.
    onMessages(token, room, cb) {
      return client.onUpdate(
        "messages:listMessages",
        { token, room },
        (v) => cb(v.messages)
      );
    },

    // One-shot presence read. Used by :join to discover which room a freshly
    // handed token belongs to (listPresence returns rows for the caller's room).
    queryPresenceOnce(token) {
      return new Promise((resolve, reject) => {
        let unsub;
        const timer = setTimeout(() => {
          unsub?.();
          reject(new Error("presence query timed out"));
        }, 10000);
        unsub = client.onUpdate(
          "presence:listPresence",
          { token },
          (v) => {
            clearTimeout(timer);
            unsub();
            resolve(v.memberships);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });
    },

    setPresence(token, online) {
      return client.mutation("presence:setPresence", { token, online });
    },

    sendMessage(token, room, text) {
      return client.mutation("messages:sendMessage", { token, room, text });
    },

    close() {
      return client.close();
    },
  };
}
