import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { readCache, appendMessage } from "./cache.js";
import { mergeMessages } from "./messages.js";
import { addMembership } from "./config.js";

const keyOf = (m) => `${m.time} ${m.personName} ${m.text}`;

// The Ink terminal app. `convex` is a createConvexClient() wrapper; `config`
// is the loaded config (Contract §3). `me` is the local person's name.
export default function App({ convex, config, me }) {
  const { exit } = useApp();

  const [memberships, setMemberships] = useState(config.memberships);
  const [selected, setSelected] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");

  // presenceByRoom[room] -> [{ personName, online, lastSeen }]
  const [presenceByRoom, setPresenceByRoom] = useState({});
  // convexByRoom[room] -> latest listMessages result
  const [convexByRoom, setConvexByRoom] = useState({});

  // Per-room startup cache seed (instant render) + set of persisted keys.
  const cacheSeed = useRef({});
  const persistedKeys = useRef({});
  const subs = useRef([]);

  const rooms = memberships.map((m) => m.room);
  const current = memberships[selected];

  // Seed local cache immediately for every known room, so history renders
  // before the Convex connection is live.
  useEffect(() => {
    for (const m of memberships) {
      if (!cacheSeed.current[m.room]) {
        const seed = readCache(m.room);
        cacheSeed.current[m.room] = seed;
        persistedKeys.current[m.room] = new Set(seed.map(keyOf));
      }
    }
    // Re-render once seeds are loaded.
    setConvexByRoom((prev) => ({ ...prev }));
  }, [memberships]);

  const subscribeRoom = useCallback(
    (m) => {
      const unsubP = convex.onPresence(m.token, (list) => {
        setPresenceByRoom((prev) => {
          const next = { ...prev };
          // A token's presence rows all share its room; group defensively.
          const byRoom = {};
          for (const row of list) {
            (byRoom[row.room] ??= []).push(row);
          }
          Object.assign(next, byRoom);
          return next;
        });
      });

      const unsubM = convex.onMessages(m.token, m.room, (list) => {
        // Persist any messages we have not written to the JSONL cache yet.
        const seen = persistedKeys.current[m.room] ?? new Set();
        for (const msg of list) {
          const k = keyOf(msg);
          if (!seen.has(k)) {
            appendMessage(m.room, msg);
            seen.add(k);
          }
        }
        persistedKeys.current[m.room] = seen;
        setConvexByRoom((prev) => ({ ...prev, [m.room]: list }));
      });

      // Announce ourselves online for this membership.
      convex.setPresence(m.token, true).catch(() => {});

      return () => {
        unsubP();
        unsubM();
      };
    },
    [convex]
  );

  // Subscribe on mount and whenever a room is added.
  useEffect(() => {
    for (const m of memberships) {
      if (!subs.current.find((s) => s.token === m.token)) {
        subs.current.push({ token: m.token, off: subscribeRoom(m) });
      }
    }
  }, [memberships, subscribeRoom]);

  // Clean up on exit: go offline, unsubscribe.
  useEffect(() => {
    return () => {
      for (const s of subs.current) s.off();
      for (const m of config.memberships) convex.setPresence(m.token, false).catch(() => {});
    };
  }, []);

  const runJoin = useCallback(
    async (token) => {
      if (!token) {
        setStatus(":join needs a token — usage: :join <token>");
        return;
      }
      if (memberships.some((m) => m.token === token)) {
        setStatus("Already joined that room.");
        return;
      }
      setStatus("Joining…");
      try {
        const rows = await convex.queryPresenceOnce(token);
        const room = rows[0]?.room;
        if (!room) {
          setStatus("That token is not in any room.");
          return;
        }
        addMembership({ room, token });
        setMemberships((prev) => [...prev, { room, token }]);
        setStatus(`Joined ${room}.`);
      } catch (err) {
        setStatus(`Join failed: ${err.message}`);
      }
    },
    [convex, memberships]
  );

  const submit = useCallback(async () => {
    const text = input;
    setInput("");
    if (!text.trim()) return;
    if (text.startsWith(":")) {
      const [cmd, ...rest] = text.slice(1).split(/\s+/);
      if (cmd === "join") return runJoin(rest[0]);
      if (cmd === "quit" || cmd === "q") return exit();
      setStatus(`Unknown command: :${cmd}`);
      return;
    }
    try {
      await convex.sendMessage(current.token, current.room, text);
      setStatus("");
    } catch (err) {
      setStatus(`Send failed: ${err.message}`);
    }
  }, [input, current, runJoin, exit]);

  useInput((ch, key) => {
    if (key.upArrow) {
      setSelected((s) => (s > 0 ? s - 1 : s));
      return;
    }
    if (key.downArrow) {
      setSelected((s) => (s < memberships.length - 1 ? s + 1 : s));
      return;
    }
    if (key.return) {
      submit();
      return;
    }
    if (key.backspace || key.delete) {
      setInput((v) => v.slice(0, -1));
      return;
    }
    if (key.ctrl && ch === "c") {
      exit();
      return;
    }
    if (ch && !key.ctrl && !key.meta) {
      setInput((v) => v + ch);
    }
  });

  // ----- Render -----
  const seed = cacheSeed.current[current?.room] ?? [];
  const convexMsgs = convexByRoom[current?.room] ?? [];
  const messages = mergeMessages(seed, convexMsgs);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">buddy-chat </Text>
        <Text dimColor>({me})</Text>
      </Box>
      <Box>
        {/* Left pane: rooms + live presence */}
        <Box flexDirection="column" width={28} marginRight={1} borderStyle="round" paddingX={1}>
          <Text bold>Rooms</Text>
          {memberships.map((m, i) => {
            const others = (presenceByRoom[m.room] ?? []).filter((p) => p.personName !== me);
            const anyOnline = others.some((p) => p.online);
            const onlineCount = others.filter((p) => p.online).length;
            return (
              <Text key={m.token} inverse={i === selected}>
                {i === selected ? "› " : "  "}
                <Text color={anyOnline ? "green" : "gray"}>{anyOnline ? "●" : "○"}</Text>
                {" "}
                {m.room} <Text dimColor>({onlineCount}/{others.length})</Text>
              </Text>
            );
          })}
        </Box>

        {/* Right pane: chat log for selected room */}
        <Box flexDirection="column" flexGrow={1} borderStyle="round" paddingX={1}>
          <Text bold>{current ? current.room : "no room"}</Text>
          {messages.length === 0 ? (
            <Text dimColor>No messages yet.</Text>
          ) : (
            messages.slice(-12).map((m, i) => (
              <Text key={`${keyOf(m)}-${i}`}>
                <Text color={m.personName === me ? "yellow" : "magenta"}>{m.personName}</Text>
                {": "}
                {m.text}
              </Text>
            ))
          )}
        </Box>
      </Box>

      <Box>
        <Text color="cyan">{"> "}</Text>
        <Text>{input}</Text>
        <Text inverse> </Text>
      </Box>
      {status ? <Text dimColor>{status}</Text> : null}
      <Text dimColor>↑/↓ switch room · type to chat · :join &lt;token&gt; · :quit</Text>
    </Box>
  );
}
