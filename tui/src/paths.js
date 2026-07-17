import { homedir } from "node:os";
import { join } from "node:path";

// Contract §3/§4 pin the on-disk layout under ~/.claude/buddy-chat.
// BUDDY_CHAT_HOME overrides the base dir for isolated testing only; it does
// not change the contract's default location.
export function buddyHome() {
  return process.env.BUDDY_CHAT_HOME || join(homedir(), ".claude", "buddy-chat");
}

export function configPath() {
  return join(buddyHome(), "config.json");
}

export function historyDir() {
  return join(buddyHome(), "history");
}

export function historyPath(room) {
  return join(historyDir(), `${room}.jsonl`);
}
