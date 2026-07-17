#!/usr/bin/env node
//
// Owner-only invite step: mints a fresh friend's token by calling Convex's
// memberships:mintToken mutation (see CONTRACT.md section 1) with the
// deployment's ADMIN_KEY. Prints the token so the owner can hand it to the
// friend out-of-band (chat/email) — the friend then runs the onboarding
// command in setup.js with it.
//
// Usage:
//   node scripts/buddy-invite.js <personName> <room>
//
// Reads ADMIN_KEY and CONVEX_URL from the environment, falling back to
// .env.local at the repo root (gitignored — never commit real secrets here).
// The admin key is never printed and never written to any tracked file.

const fs = require('fs');
const path = require('path');

function loadDotEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function mintToken({ convexUrl, adminKey, room, personName }) {
  const res = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'memberships:mintToken',
      args: { adminKey, room, personName },
      format: 'json',
    }),
  });
  const body = await res.json();
  if (body.status !== 'success') {
    throw new Error(body.errorMessage || 'mintToken failed');
  }
  return body.value.token;
}

async function main() {
  const [personName, room] = process.argv.slice(2);
  if (!personName || !room) {
    console.error('Usage: node scripts/buddy-invite.js <personName> <room>');
    process.exit(1);
  }

  loadDotEnvLocal();
  const convexUrl = process.env.CONVEX_URL;
  const adminKey = process.env.ADMIN_KEY;
  if (!convexUrl) {
    console.error('CONVEX_URL not set (expected in .env.local or the environment). Aborting.');
    process.exit(1);
  }
  if (!adminKey) {
    console.error('ADMIN_KEY not set (expected in .env.local or the environment). Aborting.');
    process.exit(1);
  }

  let token;
  try {
    token = await mintToken({ convexUrl, adminKey, room, personName });
  } catch (err) {
    console.error(`Minting failed: ${err.message}`);
    process.exit(1);
  }

  console.log('');
  console.log(`Token minted for ${personName} in room "${room}":`);
  console.log(`  ${token}`);
  console.log('');
  console.log('Hand this to your friend out-of-band (chat/email), then have them run:');
  console.log(`  npx github:XamHans/claude-buddy-chat "${personName}" "${token}"`);
  console.log('');
}

main();
