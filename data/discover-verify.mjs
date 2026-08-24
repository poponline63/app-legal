#!/usr/bin/env node
/**
 * Discovery quality gate. Takes a directory of candidate scholarship files
 * (bare JSON arrays, app schema) and decides which are safe to publish.
 *
 *   node data/discover-verify.mjs <candidates-dir> [--out <dir>]
 *
 * A candidate must clear three checks to PASS:
 *   1. Not a lead-gen / data-harvesting domain (blocklist).
 *   2. Not already in the live dataset (dedup by name+url).
 *   3. URL is live (2xx/3xx) AND the fetched page text actually mentions the
 *      scholarship (a distinctive token from its name or org appears on the
 *      page). This catches dead links, parked domains, and hijacked URLs that
 *      return 200 for unrelated content.
 *
 * A candidate whose site blocks the checker (403/429/timeout) can't be proven
 * either way, so it goes to QUARANTINE for a human/second-agent look rather than
 * being published blind or thrown away.
 *
 * Everything is reported, nothing is written to the live dataset. This measures;
 * merging is a separate deliberate step. No dependencies. Always exits 0.
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIVE = join(HERE, 'scholarships.json');
const CONCURRENCY = 8;
const TIMEOUT_MS = 12000;
const UA = 'ScholarMeDiscover/1.0 (+https://poponline63.github.io/app-legal)';
const LEADGEN = /bold\.org|niche\.com|scholarshipowl|scholarships\.com\/sweep|going-merry|goingmerry|appily\.com|unigo\.com\/scholarships\/our-scholarships|fastweb\.com\/.*sweep/i;

const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith('--')) || '.');
const outFlag = args.indexOf('--out');
const outDir = outFlag >= 0 ? resolve(args[outFlag + 1]) : dir;

// Distinctive lowercase tokens (>4 chars, not filler) from a string.
const STOP = new Set(['scholarship', 'scholarships', 'foundation', 'program', 'award', 'awards', 'fund', 'memorial', 'annual', 'student', 'students', 'college', 'university', 'national', 'america', 'american']);
function tokens(s) {
  return [...new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 4 && !STOP.has(w)))];
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
    const ok = res.status >= 200 && res.status < 400;
    let body = '';
    if (ok) { try { body = (await res.text()).slice(0, 200000).toLowerCase(); } catch { /* non-text */ } }
    return { ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.name === 'AbortError' ? 'timeout' : e?.message || e), body: '' };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

// --- load candidates ---
const files = (await readdir(dir)).filter((f) => f.endsWith('.json') && !/^(passed|quarantine|report)\b/.test(f));
const candidates = [];
for (const f of files) {
  try {
    const arr = JSON.parse(await readFile(join(dir, f), 'utf8'));
    if (Array.isArray(arr)) arr.forEach((c) => candidates.push({ ...c, __beat: f.replace('.json', '') }));
  } catch { console.error('skip unreadable', f); }
}

// --- load live dataset for dedup ---
const liveRaw = JSON.parse(await readFile(LIVE, 'utf8'));
const live = Array.isArray(liveRaw) ? liveRaw : liveRaw.scholarships;
const seen = new Set(live.map((s) => (s.name + '|' + s.url).toLowerCase()));

// Dedup candidates against live AND against each other.
const leadgen = [];
const dup = [];
const toCheck = [];
const localSeen = new Set();
for (const c of candidates) {
  if (LEADGEN.test(String(c.url))) { leadgen.push(c); continue; }
  const key = (c.name + '|' + c.url).toLowerCase();
  if (seen.has(key) || localSeen.has(key)) { dup.push(c); continue; }
  localSeen.add(key);
  toCheck.push(c);
}

// --- liveness + page-text match ---
const checked = await mapLimit(toCheck, CONCURRENCY, async (c) => {
  const r = await fetchText(c.url);
  let match = null;
  if (r.ok && r.body) {
    const toks = [...tokens(c.name), ...tokens(c.organization)];
    match = toks.length === 0 || toks.some((t) => r.body.includes(t));
  }
  // pass: live + page mentions it. quarantine: blocked (can't prove) or no text match.
  let verdict;
  if (r.ok && match === true) verdict = 'pass';
  else if (r.ok && match === false) verdict = 'quarantine-nomatch';
  else if (!r.ok && (r.status === 404 || r.status === 410)) verdict = 'dead';
  else verdict = 'quarantine-blocked';
  return { ...c, __verdict: verdict, __status: r.status, __error: r.error };
});

const pass = checked.filter((c) => c.__verdict === 'pass');
const dead = checked.filter((c) => c.__verdict === 'dead');
const quarantine = checked.filter((c) => c.__verdict.startsWith('quarantine'));

const strip = (c) => { const { __beat, __verdict, __status, __error, ...rest } = c; return rest; };
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'passed.json'), JSON.stringify(pass.map(strip), null, 2));
await writeFile(join(outDir, 'quarantine.json'), JSON.stringify(quarantine.concat(dead), null, 2));

const byBeat = {};
for (const c of candidates) { const b = c.__beat; byBeat[b] = byBeat[b] || { found: 0, pass: 0 }; byBeat[b].found++; }
for (const c of pass) byBeat[c.__beat].pass++;

const report = {
  ranAt: 'dry-run',
  candidatesFound: candidates.length,
  leadgenDropped: leadgen.length,
  alreadyInList: dup.length,
  checkedLive: toCheck.length,
  passed: pass.length,
  dead: dead.length,
  quarantined: quarantine.length,
  byBeat,
};
await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2));

console.log('=== DISCOVERY DRY-RUN REPORT ===');
console.log(`Candidates found:      ${report.candidatesFound}`);
console.log(`  dropped (lead-gen):  ${report.leadgenDropped}`);
console.log(`  already in list:     ${report.alreadyInList}`);
console.log(`  checked live:        ${report.checkedLive}`);
console.log(`PASSED (publishable):  ${report.passed}`);
console.log(`  dead (404/410):      ${report.dead}`);
console.log(`  quarantined:         ${report.quarantined}  (blocked or no page-text match, needs a look)`);
console.log('By beat (found -> passed):');
for (const [b, v] of Object.entries(byBeat)) console.log(`  ${b}: ${v.found} -> ${v.pass}`);
console.log(`\nWrote passed.json (${pass.length}), quarantine.json (${quarantine.length + dead.length}), report.json to ${outDir}`);
process.exit(0);
