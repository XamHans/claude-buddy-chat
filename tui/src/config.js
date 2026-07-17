import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buddyHome, configPath } from "./paths.js";

// Local config (Contract §3): { convexUrl, personName, memberships: [{room, token}] }
export function loadConfig() {
  const p = configPath();
  if (!existsSync(p)) {
    throw new Error(
      `No buddy-chat config found at ${p}. Run onboarding (slice 05) or write it by hand per CONTRACT.md §3.`
    );
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveConfig(cfg) {
  mkdirSync(buddyHome(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + "\n");
}

// Append a room to the local registry (used by :join). Idempotent on token.
export function addMembership({ room, token }) {
  const cfg = loadConfig();
  if (!cfg.memberships.some((m) => m.token === token)) {
    cfg.memberships.push({ room, token });
    saveConfig(cfg);
  }
  return cfg;
}
