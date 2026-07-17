#!/usr/bin/env node

// Sets up a "buddy-chat" presence + chat bridge for Claude Code:
//   - SessionStart/SessionEnd hooks in ~/.claude/settings.json post online/offline
//     status to a shared ntfy.sh topic.
//   - A /buddy-chat skill in ~/.claude/skills/buddy-chat/ to send/read messages
//     and check presence, from inside Claude Code.
//
// Usage:
//   npx github:XamHans/claude-buddy-chat <name> <topic-slug>
// or run with no args and answer the two prompts.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function skillMarkdown(name, topic) {
  return `---
name: buddy-chat
description: Send a chat message to your Claude-Code buddy or check recent messages and whether they're currently online. Bridges two separate Claude Code sessions over a shared ntfy.sh topic. Only invoke manually with /buddy-chat.
disable-model-invocation: true
allowed-tools: Bash(curl *) Write(*)
---

# Buddy chat over ntfy.sh

Presence + chat bridge between two Claude Code users, using ntfy.sh (free, no-signup pub-sub relay) as the transport. Nothing to install — plain HTTP.

- Presence topic (posted automatically by the SessionStart/SessionEnd hooks in settings.json): \`${topic}-presence\`
- Chat topic: \`${topic}-chat\`
- Your display name: ${name}

These topic names are a shared secret (random slug) — anyone who guesses them could read or post. Fine for casual chat with a friend, not for anything sensitive.

## What to do

The user's message, if any, is: $ARGUMENTS

1. If $ARGUMENTS is non-empty, send it:
   - First write the exact raw text of $ARGUMENTS to a scratch file with the Write tool (e.g. under the scratchpad directory). Never splice the raw message text directly into a shell command string — it may contain quotes/backticks/\`$(...)\` that would break or, worse, execute as shell. Always go through a file and let curl read it.
   - Then run: \`curl -s -X POST -H "Title: ${name}" --data-binary @<scratchfile> https://ntfy.sh/${topic}-chat\`
2. Always check recent activity:
   - \`curl -s "https://ntfy.sh/${topic}-chat/json?poll=1&since=2h"\` — one JSON object per line: \`time\` (unix seconds), \`title\` (sender), \`message\` (text).
   - \`curl -s "https://ntfy.sh/${topic}-presence/json?poll=1&since=6h"\` — same shape; the latest entry tells you whether the buddy currently looks online or offline.
3. Report back as a short, human-readable chat transcript (oldest to newest, sender + local time + text) plus one line on current presence. Don't dump raw JSON at the user.
`;
}

function hookEntry(command) {
  return { matcher: '', hooks: [{ type: 'command', command }] };
}

function addHookOnce(list, entry) {
  const cmd = entry.hooks[0].command;
  const exists = list.some((h) => h.hooks && h.hooks[0] && h.hooks[0].command === cmd);
  if (!exists) list.push(entry);
}

async function main() {
  let [name, topic] = process.argv.slice(2);
  if (!name) name = await prompt('Dein Anzeigename (z.B. Alex): ');
  if (!topic) topic = await prompt('Gemeinsamer Topic-Slug (von deinem Kumpel bekommen, z.B. jh-cc-28eeb54621): ');

  if (!name || !topic) {
    console.error('Name und Topic-Slug werden beide gebraucht. Abbruch.');
    process.exit(1);
  }

  const claudeDir = path.join(os.homedir(), '.claude');
  const skillDir = path.join(claudeDir, 'skills', 'buddy-chat');
  const settingsPath = path.join(claudeDir, 'settings.json');

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMarkdown(name, topic));

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.bak`);
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
  settings.hooks = settings.hooks || {};
  settings.hooks.SessionStart = settings.hooks.SessionStart || [];
  settings.hooks.SessionEnd = settings.hooks.SessionEnd || [];

  addHookOnce(settings.hooks.SessionStart, hookEntry(
    `curl -s -X POST -H 'Title: Claude Code' -H 'Tags: green_circle' -d '🟢 ${name} ist online (Claude Code)' https://ntfy.sh/${topic}-presence >/dev/null 2>&1 &`
  ));
  addHookOnce(settings.hooks.SessionEnd, hookEntry(
    `curl -s -X POST -H 'Title: Claude Code' -H 'Tags: red_circle' -d '🔴 ${name} ist offline' https://ntfy.sh/${topic}-presence >/dev/null 2>&1 &`
  ));

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

  console.log('');
  console.log(`✅ Eingerichtet für ${name}.`);
  console.log(`   Presence-Topic: ${topic}-presence`);
  console.log(`   Chat-Topic:     ${topic}-chat`);
  console.log('');
  console.log('Ab jetzt: Claude Code neu starten, dann in Claude Code eintippen:');
  console.log('   /buddy-chat Hey, bin online!');
  console.log('');
  console.log('Optional: die ntfy-App (ntfy.sh/app) installieren und beide Topics abonnieren,');
  console.log('für echte Push-Benachrichtigungen aufs Handy.');
}

main();
