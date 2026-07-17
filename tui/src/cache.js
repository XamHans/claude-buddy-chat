import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { historyDir, historyPath } from "./paths.js";

// Local chat history cache (Contract §4): one JSON object per line, append-only.
// Convex remains the source of truth; this file is a render-instantly cache.
export function appendMessage(room, msg) {
  mkdirSync(historyDir(), { recursive: true });
  appendFileSync(historyPath(room), JSON.stringify(msg) + "\n");
}

export function readCache(room) {
  const p = historyPath(room);
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // Skip corrupt lines rather than crash the TUI on startup.
    }
  }
  return out;
}
