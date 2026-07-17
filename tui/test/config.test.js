import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let home;
before(() => {
  home = mkdtempSync(join(tmpdir(), "buddy-config-"));
  process.env.BUDDY_CHAT_HOME = home;
});
after(() => {
  rmSync(home, { recursive: true, force: true });
  delete process.env.BUDDY_CHAT_HOME;
});

const { loadConfig, saveConfig, addMembership } = await import("../src/config.js");
const { configPath } = await import("../src/paths.js");

test("loadConfig throws a helpful error when no config exists", () => {
  assert.throws(() => loadConfig(), /config/i);
});

test("saveConfig then loadConfig round-trips the contract shape", () => {
  const cfg = {
    convexUrl: "https://capable-platypus-33.eu-west-1.convex.cloud",
    personName: "test-alice",
    memberships: [{ room: "test-room", token: "tok_abc" }],
  };
  saveConfig(cfg);
  assert.ok(existsSync(configPath()));
  assert.deepEqual(loadConfig(), cfg);
});

test("addMembership appends a room and persists it", () => {
  const cfg = addMembership({ room: "other-room", token: "tok_xyz" });
  assert.equal(cfg.memberships.length, 2);
  assert.deepEqual(cfg.memberships[1], { room: "other-room", token: "tok_xyz" });
  // Persisted to disk
  assert.deepEqual(loadConfig().memberships[1], { room: "other-room", token: "tok_xyz" });
});

test("addMembership is idempotent on duplicate token", () => {
  const cfg = addMembership({ room: "other-room", token: "tok_xyz" });
  assert.equal(cfg.memberships.length, 2, "should not add a duplicate token");
});
