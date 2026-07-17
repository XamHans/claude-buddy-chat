/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const ADMIN_KEY = "test-admin-key";

beforeEach(() => {
  process.env.ADMIN_KEY = ADMIN_KEY;
});

function setup() {
  return convexTest(schema, modules);
}

test("mintToken creates a membership and returns a token", async () => {
  const t = setup();
  const { token } = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Johannes",
  });
  expect(typeof token).toBe("string");
  expect(token.length).toBeGreaterThan(0);
});

test("mintToken twice with different people yields distinct tokens", async () => {
  const t = setup();
  const a = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Johannes",
  });
  const b = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Jonas",
  });
  expect(a.token).not.toBe(b.token);
});

test("mintToken rejects a wrong admin key", async () => {
  const t = setup();
  await expect(
    t.mutation(api.memberships.mintToken, {
      adminKey: "wrong",
      room: "jonas-room",
      personName: "Johannes",
    }),
  ).rejects.toThrow();
});

test("setPresence + listPresence round-trip online then offline", async () => {
  const t = setup();
  const { token } = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Johannes",
  });

  await t.mutation(api.presence.setPresence, { token, online: true });
  let res = await t.query(api.presence.listPresence, { token });
  let me = res.memberships.find((m) => m.personName === "Johannes");
  expect(me).toBeDefined();
  expect(me!.online).toBe(true);
  expect(me!.room).toBe("jonas-room");
  expect(typeof me!.lastSeen).toBe("number");

  await t.mutation(api.presence.setPresence, { token, online: false });
  res = await t.query(api.presence.listPresence, { token });
  me = res.memberships.find((m) => m.personName === "Johannes");
  expect(me!.online).toBe(false);
});

test("listPresence returns every membership in the caller's room", async () => {
  const t = setup();
  const a = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Johannes",
  });
  await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Jonas",
  });
  const res = await t.query(api.presence.listPresence, { token: a.token });
  const names = res.memberships.map((m) => m.personName).sort();
  expect(names).toEqual(["Johannes", "Jonas"]);
});

test("sendMessage + listMessages round-trip, ordered by time", async () => {
  const t = setup();
  const { token } = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Johannes",
  });

  await t.mutation(api.messages.sendMessage, {
    token,
    room: "jonas-room",
    text: "first",
  });
  await t.mutation(api.messages.sendMessage, {
    token,
    room: "jonas-room",
    text: "second",
  });

  const res = await t.query(api.messages.listMessages, {
    token,
    room: "jonas-room",
  });
  expect(res.messages.map((m) => m.text)).toEqual(["first", "second"]);
  expect(res.messages[0].personName).toBe("Johannes");
  expect(typeof res.messages[0].time).toBe("number");
});

test("listMessages honors the since filter (strictly newer than the timestamp)", async () => {
  const t = setup();
  const { token } = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Johannes",
  });
  await t.mutation(api.messages.sendMessage, {
    token,
    room: "jonas-room",
    text: "old",
  });
  const all = await t.query(api.messages.listMessages, {
    token,
    room: "jonas-room",
  });
  const t0 = all.messages[0].time;

  // `since` is exclusive: at the message's own timestamp, nothing is newer.
  const atCutoff = await t.query(api.messages.listMessages, {
    token,
    room: "jonas-room",
    since: t0,
  });
  expect(atCutoff.messages.map((m) => m.text)).toEqual([]);

  // One second earlier, the message is returned.
  const beforeCutoff = await t.query(api.messages.listMessages, {
    token,
    room: "jonas-room",
    since: t0 - 1,
  });
  expect(beforeCutoff.messages.map((m) => m.text)).toEqual(["old"]);
});

test("setPresence with a made-up token is rejected", async () => {
  const t = setup();
  await expect(
    t.mutation(api.presence.setPresence, { token: "tok_bogus", online: true }),
  ).rejects.toThrow();
});

test("sendMessage with a made-up token is rejected and writes nothing", async () => {
  const t = setup();
  const { token } = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Johannes",
  });
  await expect(
    t.mutation(api.messages.sendMessage, {
      token: "tok_bogus",
      room: "jonas-room",
      text: "intruder",
    }),
  ).rejects.toThrow();

  const res = await t.query(api.messages.listMessages, {
    token,
    room: "jonas-room",
  });
  expect(res.messages.length).toBe(0);
});

test("sendMessage into a room the token does not belong to is rejected", async () => {
  const t = setup();
  const { token } = await t.mutation(api.memberships.mintToken, {
    adminKey: ADMIN_KEY,
    room: "jonas-room",
    personName: "Johannes",
  });
  await expect(
    t.mutation(api.messages.sendMessage, {
      token,
      room: "someone-elses-room",
      text: "leak",
    }),
  ).rejects.toThrow();
});
