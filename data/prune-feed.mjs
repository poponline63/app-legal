#!/usr/bin/env node
/**
 * Keeps the live list honest between discovery runs. Applied to the hosted
 * dataset (and, with --bundled, the app's bundled copy) identically:
 *
 *   1. Drops awards whose deadline has passed. A student cannot apply, and the
 *      app shows exact dates, so a guessed "next cycle" date would mislead. The
 *      dropped rows go to discover/expired-<date>.json so the next discovery run
 *      can re-verify the new cycle and bring them back with a real date.
 *   2. Drops awards whose apply link is dead, per a verify-live.mjs report
 *      (404/410), plus any ids in --drop (a JSON array of {id, reason}).
 *   3. Re-points links listed in --repair (a JSON array of {id, url, how}).
 *   4. Bumps `version`, sets `updatedAt`.
 *
 *   node data/prune-feed.mjs [--report data/freshness-report.json] [--drop ids.json]
 *                            [--repair repairs.json] [--bundled ../scholarme/src/data/scholarships.json]
 *                            [--date YYYY-MM-DD] [--dry]
 *
 * Dates are compared as calendar days (YYYY-MM-DD strings), never through
 * new Date(), so the result does not depend on the runner's time zone.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOSTED = join(HERE, 'scholarships.json');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const DRY = args.includes('--dry');

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Default to the US day (America/Los_Angeles) so a UTC runner never drops an
// award that is still open on the West Coast.
const usToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
const TODAY = opt('--date') || (process.env.CI ? usToday() : localToday());

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const report = opt('--report') ? readJson(opt('--report')) : null;
const dropList = opt('--drop') ? readJson(opt('--drop')) : [];
const repairList = opt('--repair') ? readJson(opt('--repair')) : [];

const deadIds = new Map();
for (const b of report?.brokenList ?? []) deadIds.set(b.id, `dead link (${b.status})`);
for (const d of dropList) deadIds.set(d.id, d.reason || 'dead link');
const repairs = new Map(repairList.map((r) => [r.id, r]));

function prune(list) {
  const kept = [];
  const expired = [];
  const dead = [];
  const repaired = [];
  for (const s of list) {
    if (repairs.has(s.id)) {
      const r = repairs.get(s.id);
      repaired.push({ id: s.id, name: s.name, from: s.url, to: r.url, how: r.how });
      s.url = r.url;
    } else if (deadIds.has(s.id)) {
      dead.push({ ...s, _reason: deadIds.get(s.id) });
      continue;
    }
    if (typeof s.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.deadline) && s.deadline < TODAY) {
      expired.push(s);
      continue;
    }
    kept.push(s);
  }
  return { kept, expired, dead, repaired };
}

const hosted = readJson(HOSTED);
const h = prune(hosted.scholarships);
const before = hosted.scholarships.length;
hosted.scholarships = h.kept;
hosted.version = Number(hosted.version || 0) + 1;
hosted.updatedAt = TODAY;

console.log(`Date: ${TODAY}`);
console.log(`Hosted: ${before} -> ${h.kept.length} (expired ${h.expired.length}, dead links ${h.dead.length}, repaired ${h.repaired.length}), version ${hosted.version}`);
for (const r of h.repaired) console.log(`  repaired [${r.id}] ${r.name}: ${r.from} -> ${r.to}`);
for (const d of h.dead) console.log(`  dead [${d.id}] ${d.name} (${d._reason}) ${d.url}`);

let bundledOut = null;
const bundledPath = opt('--bundled') ? resolve(opt('--bundled')) : null;
if (bundledPath && existsSync(bundledPath)) {
  const raw = readJson(bundledPath);
  const arr = Array.isArray(raw) ? raw : raw.scholarships;
  // Re-read the hosted rows fresh so repairs are not applied twice.
  const b = prune(arr);
  bundledOut = Array.isArray(raw) ? b.kept : { ...raw, scholarships: b.kept };
  console.log(`Bundled: ${arr.length} -> ${b.kept.length}`);
  if (b.kept.length !== h.kept.length) {
    console.error('MISMATCH: hosted and bundled differ after pruning. Sync them first (merge-discovery.mjs).');
    process.exit(1);
  }
}

if (!DRY) {
  writeFileSync(HOSTED, JSON.stringify(hosted, null, 2));
  if (bundledOut) writeFileSync(bundledPath, JSON.stringify(bundledOut, null, 2));
  const q = join(HERE, '..', 'discover', `pruned-${TODAY}.json`);
  writeFileSync(
    q,
    JSON.stringify(
      {
        date: TODAY,
        note: 'Removed from the live list. Expired rows are candidates for the next discovery run: re-verify the new cycle date, then merge back.',
        expired: h.expired,
        deadLinks: h.dead,
        repaired: h.repaired,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${q}`);
} else console.log('(dry run, nothing written)');
