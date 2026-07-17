import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeMessages } from "../src/messages.js";

const a = { personName: "Alice", text: "hey", time: 100 };
const b = { personName: "Bob", text: "yo", time: 200 };
const c = { personName: "Alice", text: "later", time: 300 };

test("merge sorts by time ascending", () => {
  assert.deepEqual(mergeMessages([c, a], [b]), [a, b, c]);
});

test("merge dedupes identical messages present in both cache and convex", () => {
  assert.deepEqual(mergeMessages([a, b], [b, c]), [a, b, c]);
});

test("merge handles empty inputs", () => {
  assert.deepEqual(mergeMessages([], []), []);
  assert.deepEqual(mergeMessages([a], []), [a]);
  assert.deepEqual(mergeMessages([], [a]), [a]);
});

test("two distinct messages with the same timestamp are both kept", () => {
  const d = { personName: "Bob", text: "hey", time: 100 };
  const merged = mergeMessages([a], [d]);
  assert.equal(merged.length, 2);
});
