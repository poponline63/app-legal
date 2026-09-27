#!/usr/bin/env node
/**
 * Post-merge cleanup for a discovery run. Two jobs, applied to the hosted and
 * bundled datasets identically so they never drift apart:
 *
 *   1. Roll any deadline that has already passed forward one year and tag the
 *      entry "deadline-approx". validate-scholarships.mjs only warns about
 *      expired rows, so without this the list quietly goes stale while still
 *      printing PASS.
 *   2. Drop legacy lead-gen rows (bold.org, niche.com, scholarshipowl, appily,
 *      unigo, fastweb, going-merry). The discovery gate only screens new
 *      candidates, so rows from before the blocklist survive forever otherwise.
 *      Students should not be routed to data-harvest sites.
 *
 *   node data/roll-deadlines.mjs [--date YYYY-MM-DD] [--dry]
 *
 * Exit 0 on success. Prints what it changed. No dependencies.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOSTED = join(HERE, 'scholarships.json');
const BUNDLED = resolve(HERE, '../../scholarme/src/data/scholarships.json');

const args = process.argv.slice(2);
const dateFlag = args.indexOf('--date');
const DRY = args.includes('--dry');
const today = dateFlag >= 0 ? new Date(`${args[dateFlag + 1]}T00:00:00`) : new Date();
today.setHours(0, 0, 0, 0);

const LEADGEN = /bold\.org|niche\.com|scholarshipowl|going-merry|goingmerry|appily\.com|unigo\.com|fastweb\.com|scholarships\.com\/sweep/i;

/** Same month/day next year. Feb 29 lands on Feb 28 in a non-leap year. */
function nextCycle(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (new Date(`${target}T00:00:00`).getUTCDate() === d) return target;
  return `${y + 1}-${String(m).padStart(2, '0')}-28`;
}

function clean(list) {
  const rolled = [];
  const dropped = [];
  const out = [];
  for (const s of list) {
    if (LEADGEN.test(String(s.url))) { dropped.push(s); continue; }
    const due = new Date(`${s.deadline}T00:00:00`);
    if (!Number.isNaN(due.getTime()) && due < today) {
      const was = s.deadline;
      s.deadline = nextCycle(s.deadline);
      s.tags = Array.isArray(s.tags) ? s.tags : [];
      if (!s.tags.includes('deadline-approx')) s.tags.push('deadline-approx');
      rolled.push(`${s.name}: ${was} -> ${s.deadline}`);
    }
    out.push(s);
  }
  return { out, rolled, dropped };
}

const hosted = JSON.parse(readFileSync(HOSTED, 'utf8'));
const bundledRaw = JSON.parse(readFileSync(BUNDLED, 'utf8'));
const bundledArr = Array.isArray(bundledRaw) ? bundledRaw : bundledRaw.scholarships;

const h = clean(hosted.scholarships);
const b = clean(bundledArr);

console.log(`Rolled ${h.rolled.length} passed deadlines (hosted), ${b.rolled.length} (bundled)`);
for (const r of h.rolled) console.log(`  - ${r}`);
console.log(`Dropped ${h.dropped.length} legacy lead-gen rows (hosted), ${b.dropped.length} (bundled)`);
for (const d of h.dropped) console.log(`  - ${d.name} (${d.url})`);

hosted.scholarships = h.out;
hosted.updatedAt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

if (!DRY) {
  writeFileSync(HOSTED, JSON.stringify(hosted, null, 2));
  if (Array.isArray(bundledRaw)) writeFileSync(BUNDLED, JSON.stringify(b.out, null, 2));
  else { bundledRaw.scholarships = b.out; writeFileSync(BUNDLED, JSON.stringify(bundledRaw, null, 2)); }
}

console.log(`Hosted: ${hosted.scholarships.length} entries, version ${hosted.version}, updatedAt ${hosted.updatedAt}`);
console.log(`Bundled: ${b.out.length} entries`);
if (hosted.scholarships.length !== b.out.length) {
  console.error('MISMATCH: hosted and bundled entry counts differ. Both datasets must stay in step.');
  process.exit(1);
}
if (DRY) console.log('(dry run, nothing written)');
