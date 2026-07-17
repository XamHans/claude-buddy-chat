#!/usr/bin/env node

// Friend-side onboarding for "buddy-chat": seeds the local config (CONTRACT.md
// section 3), wires the SessionStart/SessionEnd presence hooks, installs the
// TUI (Ink) + its dependencies, installs the Claude Code skill, and adds a
// `buddy` shell alias — idempotent on rerun, additive to any existing
// ~/.claude/settings.json content.
//
// Usage:
//   npx github:XamHans/claude-buddy-chat <name> <token>
// or run with no args and answer the two prompts.
//
// <token> is minted by the room's owner (scripts/buddy-invite.js) and handed
// to you out-of-band. The room itself is discovered automatically from the
// token via Convex's presence:listPresence — you don't need to know it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

// Fixed Convex deployment for this friend group (CONTRACT.md section 3) —
// every friend's client talks to the same project.
const CONVEX_URL = 'https://capable-platypus-33.eu-west-1.convex.cloud';

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function resolveRoom(token) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'presence:listPresence', args: { token }, format: 'json' }),
  });
  const body = await res.json();
  if (body.status !== 'success') {
    throw new Error(body.errorMessage || 'token was rejected by Convex');
  }
  const memberships = body.value.memberships;
  if (!memberships || memberships.length === 0) {
    throw new Error('token is valid but has no membership — ask whoever minted it');
  }
  return memberships[0].room;
}

// --- local config (CONTRACT.md section 3) ---------------------------------

function writeConfig(claudeDir, { name, token, room }) {
  const configPath = path.join(claudeDir, 'buddy-chat', 'config.json');
  let config = { convexUrl: CONVEX_URL, personName: name, memberships: [] };
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      // Corrupt/unreadable existing file: start fresh rather than fail onboarding.
    }
  }
  config.convexUrl = CONVEX_URL;
  config.personName = name;
  if (!Array.isArray(config.memberships)) config.memberships = [];
  if (!config.memberships.some((m) => m.token === token)) {
    config.memberships.push({ room, token });
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

// --- presence/status-line scripts (slice 02, repo-tracked at scripts/) ----

function installScripts(claudeDir) {
  const destDir = path.join(claudeDir, 'buddy-chat');
  fs.mkdirSync(destDir, { recursive: true });
  const files = [
    ['buddy-presence.sh', 'presence.sh'],
    ['buddy-statusline.sh', 'statusline.sh'],
  ];
  for (const [src, dest] of files) {
    const destPath = path.join(destDir, dest);
    fs.copyFileSync(path.join(__dirname, 'scripts', src), destPath);
    fs.chmodSync(destPath, 0o755);
  }
  return path.join(destDir, 'presence.sh');
}

// --- SessionStart/SessionEnd hooks, additive merge into settings.json -----

function hookEntry(command) {
  return { matcher: '', hooks: [{ type: 'command', command }] };
}

function addHookOnce(list, entry) {
  const cmd = entry.hooks[0].command;
  const exists = list.some((h) => h.hooks && h.hooks[0] && h.hooks[0].command === cmd);
  if (!exists) list.push(entry);
}

function wireSettings(claudeDir, presenceScriptPath) {
  const settingsPath = path.join(claudeDir, 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, `${settingsPath}.bak`);
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
  settings.hooks = settings.hooks || {};
  settings.hooks.SessionStart = settings.hooks.SessionStart || [];
  settings.hooks.SessionEnd = settings.hooks.SessionEnd || [];

  addHookOnce(settings.hooks.SessionStart, hookEntry(
    `sh ${presenceScriptPath} online >/dev/null 2>&1 &`
  ));
  addHookOnce(settings.hooks.SessionEnd, hookEntry(
    `sh ${presenceScriptPath} offline >/dev/null 2>&1 &`
  ));

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

// --- TUI install (slice 03, repo-tracked at tui/) --------------------------

function copyDirSync(src, dest, skipNames) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skipNames.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d, skipNames);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function installTui(claudeDir) {
  const tuiDest = path.join(claudeDir, 'buddy-chat', 'tui');
  copyDirSync(path.join(__dirname, 'tui'), tuiDest, ['node_modules']);

  const alreadyInstalled = fs.existsSync(path.join(tuiDest, 'node_modules', 'ink'))
    && fs.existsSync(path.join(tuiDest, 'node_modules', 'react'));
  if (alreadyInstalled) {
    console.log('tui/ dependencies already installed, skipping npm install.');
  } else {
    console.log('Installing tui/ dependencies (npm install — this can take a moment)...');
    const result = spawnSync('npm', ['install'], { cwd: tuiDest, stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error('npm install failed inside the installed tui/ directory');
    }
  }
  return path.join(tuiDest, 'bin', 'buddy-chat-tui.js');
}

// --- Claude Code skill (slice 04, repo-tracked at skill-template/) --------

function installSkill(claudeDir) {
  const skillDir = path.join(claudeDir, 'skills', 'buddy-chat');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, 'skill-template', 'SKILL.md'),
    path.join(skillDir, 'SKILL.md')
  );
}

// --- `buddy` shell alias, additive to ~/.zshrc / ~/.bashrc -----------------

const ALIAS_MARKER = '# buddy-chat alias (added by claude-buddy-chat onboarding)';

function aliasLine(tuiEntryPath) {
  // `node --import tsx` resolves "tsx" relative to the shell's cwd at
  // invocation time, not relative to tuiEntryPath — so it fails whenever
  // `buddy` is typed from any directory other than tui/ itself (i.e.
  // always, in real use). Call tui/'s own locally-installed tsx binary
  // directly instead; that resolves correctly regardless of cwd.
  const tuiDir = path.dirname(path.dirname(tuiEntryPath));
  const tsxBin = path.join(tuiDir, 'node_modules', '.bin', 'tsx');
  return `alias buddy="'${tsxBin}' '${tuiEntryPath}'"`;
}

function addAliasOnce(rcPath, line) {
  let content = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf8') : '';
  if (content.includes(line)) return;
  const sep = content.length && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(rcPath, `${content}${sep}${ALIAS_MARKER}\n${line}\n`);
}

function wireAlias(home, tuiEntryPath) {
  const line = aliasLine(tuiEntryPath);
  const candidates = ['.zshrc', '.bashrc'].map((f) => path.join(home, f));
  const existing = candidates.filter((p) => fs.existsSync(p));
  const targets = existing.length ? existing : [path.join(home, '.zshrc')];
  for (const rc of targets) addAliasOnce(rc, line);
  return targets;
}

// --- main -------------------------------------------------------------------

async function main() {
  let [name, token] = process.argv.slice(2);
  if (!name) name = await prompt('Dein Anzeigename (z.B. Alex): ');
  if (!token) token = await prompt('Dein Token (von deinem Kumpel bekommen): ');

  if (!name || !token) {
    console.error('Name und Token werden beide gebraucht. Abbruch.');
    process.exit(1);
  }

  console.log('Prüfe Token gegen Convex...');
  let room;
  try {
    room = await resolveRoom(token);
  } catch (err) {
    console.error(`Setup abgebrochen: ${err.message}`);
    process.exit(1);
  }

  const home = os.homedir();
  const claudeDir = path.join(home, '.claude');

  writeConfig(claudeDir, { name, token, room });
  const presenceScriptPath = installScripts(claudeDir);
  wireSettings(claudeDir, presenceScriptPath);
  const tuiEntryPath = installTui(claudeDir);
  installSkill(claudeDir);
  const rcFiles = wireAlias(home, tuiEntryPath);

  console.log('');
  console.log(`✅ Eingerichtet für ${name} im Raum "${room}".`);
  console.log(`   Config:        ${path.join(claudeDir, 'buddy-chat', 'config.json')}`);
  console.log(`   TUI:           ${tuiEntryPath}`);
  console.log(`   Skill:         ${path.join(claudeDir, 'skills', 'buddy-chat', 'SKILL.md')}`);
  console.log(`   Alias 'buddy': ${rcFiles.join(', ')} (neues Terminal öffnen oder Shell neu laden)`);
  console.log('');
  console.log('Ab jetzt: Claude Code neu starten (Presence-Hook aktiv), und `buddy` in einem');
  console.log('neuen Terminal tippen für die Chat-Oberfläche. In Claude Code außerdem:');
  console.log('   /buddy-chat Hey, bin online!');
  console.log('');
}

main();
