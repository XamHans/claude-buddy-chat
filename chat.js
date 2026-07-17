#!/usr/bin/env node

// Standalone live terminal chat over ntfy.sh — no Claude Code involved.
// Type a line + Enter to send, incoming messages print as they arrive.
//
// Usage:
//   node chat.js <name> <topic-slug>
// If omitted, both are auto-detected from ~/.claude/skills/buddy-chat/SKILL.md
// (the file the setup.js command creates), so on a machine that already ran
// setup, plain `node chat.js` just works.

const https = require('https');
const readline = require('readline');
const fs = require('fs');
const os = require('os');
const path = require('path');

function detectFromSkill() {
  const skillPath = path.join(os.homedir(), '.claude', 'skills', 'buddy-chat', 'SKILL.md');
  if (!fs.existsSync(skillPath)) return {};
  const content = fs.readFileSync(skillPath, 'utf8');
  const topicMatch = content.match(/Chat topic: `([^`]+)-chat`/);
  const nameMatch = content.match(/Your display name: (.+)/);
  return {
    topic: topicMatch ? topicMatch[1] : null,
    name: nameMatch ? nameMatch[1].trim() : null,
  };
}

let [name, topic] = process.argv.slice(2);
if (!name || !topic) {
  const detected = detectFromSkill();
  name = name || detected.name;
  topic = topic || detected.topic;
}

if (!name || !topic) {
  console.error('Nutzung: node chat.js <name> <topic-slug>');
  console.error('(oder erst `npx github:XamHans/claude-buddy-chat <name> <topic-slug>` laufen lassen, dann geht es ohne Argumente)');
  process.exit(1);
}

const CHAT_URL = `https://ntfy.sh/${topic}-chat`;

function fmtTime(unixSec) {
  return new Date(unixSec * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function send(text) {
  const data = Buffer.from(text, 'utf8');
  const req = https.request(CHAT_URL, {
    method: 'POST',
    headers: {
      Title: name,
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': data.length,
    },
  });
  req.on('error', (err) => console.error(`\n⚠️  Senden fehlgeschlagen: ${err.message}`));
  req.end(data);
}

let buffer = '';
function connect() {
  const req = https.get(`${CHAT_URL}/json`, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line.trim()) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        if (obj.event === 'message' && obj.title !== name) {
          process.stdout.write(`\r\x1b[K[${fmtTime(obj.time)}] ${obj.title || 'buddy'}: ${obj.message}\n`);
          rl.prompt(true);
        }
      }
    });
    res.on('end', () => setTimeout(connect, 2000));
    res.on('error', () => setTimeout(connect, 3000));
  });
  req.on('error', () => setTimeout(connect, 3000));
}

console.log(`💬 Buddy-Chat live — Topic: ${topic}-chat — du bist: ${name}`);
console.log('Tippen + Enter zum Senden. Strg+C zum Beenden.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
connect();
rl.prompt();
rl.on('line', (line) => {
  const text = line.trim();
  if (text) {
    send(text);
    console.log(`\x1b[2m[${fmtTime(Date.now() / 1000)}] ${name} (du): ${text}\x1b[0m`);
  }
  rl.prompt();
});
rl.on('SIGINT', () => {
  console.log('\n👋 Tschüss!');
  process.exit(0);
});
