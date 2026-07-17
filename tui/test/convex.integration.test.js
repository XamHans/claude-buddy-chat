import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createConvexClient } from "../src/convex.js";

const URL = "https://capable-platypus-33.eu-west-1.convex.cloud";
const ALICE = "tok_712c6210f6d64f1a88609c6458cd6adc";
const BOB = "tok_b04a28d827e84f7b90961081f2155f9e";
const ROOM = "test-room";

function waitFor(predicate, { timeout = 15000, interval = 100 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      let done = false;
      try {
        done = predicate();
      } catch {
        done = false;
      }
      if (done) return resolve();
      if (Date.now() - start > timeout) return reject(new Error("waitFor timeout"));
      setTimeout(tick, interval);
    };
    tick();
  });
}

test("presence subscription returns real memberships for the caller's room", async () => {
  const client = createConvexClient(URL);
  let latest = null;
  const unsub = client.onPresence(ALICE, (m) => { latest = m; });
  await waitFor(() => latest !== null);
  assert.ok(Array.isArray(latest));
  const names = latest.map((m) => m.personName);
  assert.ok(names.includes("test-alice"), "expected test-alice in presence");
  assert.ok(names.includes("test-bob"), "expected test-bob in presence");
  for (const m of latest) {
    assert.equal(m.room, ROOM);
    assert.equal(typeof m.online, "boolean");
    assert.equal(typeof m.lastSeen, "number");
  }
  unsub();
  await client.close();
});

test("setPresence(online) reflects live in another client's presence subscription", async () => {
  const alice = createConvexClient(URL);
  const bob = createConvexClient(URL);

  let bobView = [];
  const unsub = bob.onPresence(BOB, (m) => { bobView = m; });
  await waitFor(() => bobView.length > 0);

  await alice.setPresence(ALICE, true);
  await waitFor(() =>
    bobView.some((m) => m.personName === "test-alice" && m.online === true)
  );

  await alice.setPresence(ALICE, false);
  await waitFor(() =>
    bobView.some((m) => m.personName === "test-alice" && m.online === false)
  );

  unsub();
  await alice.close();
  await bob.close();
});

test("message sent by one client appears live in another client's subscription", async () => {
  const alice = createConvexClient(URL);
  const bob = createConvexClient(URL);

  let bobMsgs = [];
  const unsub = bob.onMessages(BOB, ROOM, (m) => { bobMsgs = m; });
  await waitFor(() => Array.isArray(bobMsgs));

  const marker = `hello-from-alice-${Date.now()}`;
  await alice.sendMessage(ALICE, ROOM, marker);

  await waitFor(() => bobMsgs.some((m) => m.text === marker), { timeout: 15000 });
  const got = bobMsgs.find((m) => m.text === marker);
  assert.equal(got.personName, "test-alice");
  assert.equal(typeof got.time, "number");

  unsub();
  await alice.close();
  await bob.close();
});
