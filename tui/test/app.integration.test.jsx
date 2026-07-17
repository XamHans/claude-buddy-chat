import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = "https://capable-platypus-33.eu-west-1.convex.cloud";
const ALICE = "tok_712c6210f6d64f1a88609c6458cd6adc";
const BOB = "tok_b04a28d827e84f7b90961081f2155f9e";

let home;
before(() => {
  home = mkdtempSync(join(tmpdir(), "buddy-app-"));
  process.env.BUDDY_CHAT_HOME = home;
});
after(() => {
  rmSync(home, { recursive: true, force: true });
  delete process.env.BUDDY_CHAT_HOME;
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForFrame(getFrame, predicate, { timeout = 15000, interval = 100 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const f = getFrame() ?? "";
      if (predicate(f)) return resolve(f);
      if (Date.now() - start > timeout) {
        return reject(new Error("waitForFrame timeout; last frame:\n" + f));
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

test("App renders rooms with live presence, sends+persists a message, and :join adds a room without restart", async () => {
  const { saveConfig } = await import("../src/config.js");
  const { createConvexClient } = await import("../src/convex.js");
  const { historyPath } = await import("../src/paths.js");

  saveConfig({
    convexUrl: URL,
    personName: "test-alice",
    memberships: [{ room: "test-room", token: ALICE }],
  });

  const convex = createConvexClient(URL);
  const App = (await import("../src/App.jsx")).default;
  const { lastFrame, stdin, unmount } = render(
    <App convex={convex} config={{ convexUrl: URL, personName: "test-alice", memberships: [{ room: "test-room", token: ALICE }] }} me="test-alice" />
  );

  // 1. Rooms list renders from real Convex presence (shows the room + a
  //    presence indicator for the other member, test-bob).
  await waitForFrame(lastFrame, (f) => f.includes("test-room"));
  await waitForFrame(lastFrame, (f) => /Rooms/.test(f) && /\(\d\/\d\)/.test(f));

  // 2. Type a message and press Enter -> sent to Convex, echoes back live,
  //    and is persisted to the local JSONL cache.
  const marker = `app-msg-${Date.now()}`;
  await sleep(300); // let ink settle before feeding input (test-harness timing)
  stdin.write(marker);
  await waitForFrame(lastFrame, (f) => f.includes(marker)); // shows in input line
  await sleep(100);
  stdin.write("\r"); // Enter

  await waitForFrame(lastFrame, (f) => f.includes("test-alice") && f.includes(marker));

  // Persisted to disk (cache reflects what was sent).
  await waitForFrame(
    () => (existsSync(historyPath("test-room")) ? readFileSync(historyPath("test-room"), "utf8") : ""),
    (raw) => raw.includes(marker)
  );

  // 3. :join <bob token> adds a second membership without restarting.
  await sleep(300);
  stdin.write(":join " + BOB);
  await waitForFrame(lastFrame, (f) => f.includes(":join " + BOB));
  await sleep(100);
  stdin.write("\r");

  // The join actually landed: config now holds a second membership (bob's
  // token) persisted to disk, and the TUI reports it — no restart involved.
  const cfgPath = join(home, "config.json");
  await waitForFrame(
    () => JSON.parse(readFileSync(cfgPath, "utf8")).memberships.length,
    (n) => n === 2
  );
  await waitForFrame(lastFrame, (f) => f.includes("Joined"));
  const saved = JSON.parse(readFileSync(cfgPath, "utf8"));
  assert.equal(saved.memberships.length, 2);
  assert.equal(saved.memberships[1].token, BOB);

  unmount();
  await convex.close();
});
