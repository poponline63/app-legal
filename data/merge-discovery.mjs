#!/usr/bin/env node
/**
 * Merges gate-passed discovery candidates into both the bundled and hosted
 * scholarships.json. Input is a passed.json produced by discover-verify.mjs
 * (already live-checked + page-confirmed), so this only normalizes and merges.
 *
 *   node data/merge-discovery.mjs <passed.json>
 *
 * Discovery agents already emit valid enum slugs, so majors/ethnicity/gender
 * pass through with an enum guard (unlike the state importer, which keyword-maps
 * free text). Category still maps the two aliases. Dedup by name+url against
 * both datasets makes a re-run safe. Bumps the hosted version so installed apps
 * pick it up on their next 6-hour refresh.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOSTED = join(HERE, 'scholarships.json');
const BUNDLED = resolve(HERE, '../../scholarme/src/data/scholarships.json');

const input = process.argv[2];
if (!input) { console.error('usage: node data/merge-discovery.mjs <passed.json>'); process.exit(1); }

const decode = (s) => typeof s === 'string'
  ? s.replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  : s;

const VALID_MAJORS = new Set(['stem', 'business', 'arts', 'healthcare', 'education', 'law', 'engineering', 'computer_science', 'liberal_arts', 'undecided']);
const VALID_ETH = new Set(['prefer_not_to_say', 'african_american', 'hispanic', 'asian', 'native_american', 'white', 'pacific_islander', 'multiracial', 'other']);
const CATEGORY = { diversity: 'identity', field_specific: 'stem' };
const LEADGEN = /bold\.org|niche\.com|scholarshipowl|scholarships\.com\/sweep|going-merry|goingmerry|appily\.com/i;

const guardArr = (arr, valid) => Array.isArray(arr) ? (arr.filter((x) => valid.has(x)).length ? arr.filter((x) => valid.has(x)) : null) : null;

const raw = JSON.parse(readFileSync(resolve(input), 'utf8'));
const hosted = JSON.parse(readFileSync(HOSTED, 'utf8'));
const bundled = JSON.parse(readFileSync(BUNDLED, 'utf8'));
const bundledArr = Array.isArray(bundled) ? bundled : bundled.scholarships;

const seen = new Set([...hosted.scholarships, ...bundledArr].map((s) => (s.name + '|' + s.url).toLowerCase()));
let nextId = Math.max(...hosted.scholarships.map((s) => s.id), ...bundledArr.map((s) => s.id)) + 1;

const normalized = [];
for (const s of raw) {
  if (LEADGEN.test(decode(s.url))) continue;
  const key = (decode(s.name) + '|' + decode(s.url)).toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  const { source_note, ...rest } = s;
  normalized.push({
    ...rest,
    id: nextId++,
    name: decode(s.name),
    organization: decode(s.organization),
    amountLabel: decode(s.amountLabel),
    description: decode(s.description),
    url: decode(s.url),
    amount: s.amount && s.amount > 0 ? s.amount : 2500,
    category: CATEGORY[s.category] || s.category,
    eligibility: {
      ...s.eligibility,
      ethnicity: guardArr(s.eligibility.ethnicity, VALID_ETH),
      majors: guardArr(s.eligibility.majors, VALID_MAJORS),
      gender: Array.isArray(s.eligibility.gender) ? (s.eligibility.gender[0] || null) : (s.eligibility.gender ?? null),
    },
  });
}

hosted.scholarships = [...hosted.scholarships, ...normalized];
hosted.version = (hosted.version || 0) + 1;
if (Array.isArray(bundled)) writeFileSync(BUNDLED, JSON.stringify([...bundled, ...normalized], null, 2));
else { bundled.scholarships = [...bundledArr, ...normalized]; writeFileSync(BUNDLED, JSON.stringify(bundled, null, 2)); }
writeFileSync(HOSTED, JSON.stringify(hosted, null, 2));

console.log(`Merged ${normalized.length} discovery scholarships. Hosted version -> ${hosted.version}, total ${hosted.scholarships.length}`);
