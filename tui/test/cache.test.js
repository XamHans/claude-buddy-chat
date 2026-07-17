import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let home;
before(() => {
  home = mkdtempSync(join(tmpdir(), "buddy-cache-"));
  process.env.BUDDY_CHAT_HOME = home;
});
after(() => {
  rmSync(home, { recursive: true, force: true });
  delete process.env.BUDDY_CHAT_HOME;
});

const { appendMessage, readCache } = await import("../src/cache.js");
const { historyPath } = await import("../src/paths.js");

test("readCache returns [] for a room with no cache file", () => {
  assert.deepEqual(readCache("nope"), []);
});

test("appendMessage creates the JSONL file and readCache reads it back", () => {
  const m1 = { personName: "Alice", text: "hey", time: 1784291334 };
  const m2 = { personName: "Bob", text: "yo", time: 1784291340 };
  appendMessage("test-room", m1);
  appendMessage("test-room", m2);

  assert.ok(existsSync(historyPath("test-room")), "history file should exist");
  assert.deepEqual(readCache("test-room"), [m1, m2]);
});

test("cache file is genuine append-only JSONL (one JSON object per line)", () => {
  const raw = readFileSync(historyPath("test-room"), "utf8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  assert.equal(lines.length, 2);
  for (const line of lines) {
    const obj = JSON.parse(line);
    assert.ok(typeof obj.personName === "string");
    assert.ok(typeof obj.text === "string");
    assert.ok(typeof obj.time === "number");
  }
});

test("readCache skips blank/corrupt lines without throwing", () => {
  // Append a raw broken line then a good one.
  const p = historyPath("test-room");
  appendFileSync(p, "not-json\n");
  appendMessage("test-room", { personName: "Cara", text: "ok", time: 1784291350 });
  const all = readCache("test-room");
  assert.equal(all.length, 3);
  assert.equal(all[2].personName, "Cara");
});
