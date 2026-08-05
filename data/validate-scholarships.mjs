#!/usr/bin/env node
/**
 * Validates data/scholarships.json before it goes live.
 *
 * The ScholarMe app fetches this file at runtime and falls back to its bundled
 * copy on any malformed payload, so a broken push here is silent: students keep
 * seeing the old list and nobody finds out. Run this before every commit.
 *
 *   node data/validate-scholarships.mjs
 *   node data/validate-scholarships.mjs path/to/scholarships.json
 *   node data/validate-scholarships.mjs --url https://poponline63.github.io/app-legal/data/scholarships.json
 *
 * Exit 0 = safe to publish. Exit 1 = hard error, do not publish.
 * Past deadlines are warnings, not errors: an expired entry is stale content,
 * not a broken file, and the app still renders it correctly.
 *
 * No dependencies. Plain Node, works on any version with fetch (18+).
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const errors = [];
const warnings = [];

const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

/** Fields every entry must carry, with the type each one must be. */
const REQUIRED = {
  id: 'number',
  name: 'string',
  organization: 'string',
  amount: 'number',
  amountLabel: 'string',
  deadline: 'string',
  description: 'string',
  url: 'string',
  category: 'string',
  noEssay: 'boolean',
  renewable: 'boolean',
};

const VALID_GRADE_LEVELS = new Set([
  'high_school_junior',
  'high_school_senior',
  'college_freshman',
  'college_sophomore',
  'college_junior',
  'college_senior',
  'grad_student',
]);

const VALID_MAJORS = new Set([
  'stem',
  'business',
  'arts',
  'healthcare',
  'education',
  'law',
  'engineering',
  'computer_science',
  'liberal_arts',
  'undecided',
]);

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isWellFormedUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function validateEligibility(elig, where) {
  if (typeName(elig) !== 'object') {
    err(`${where}: eligibility must be an object, got ${typeName(elig)}`);
    return;
  }

  if (!Array.isArray(elig.grade_levels)) {
    err(`${where}: eligibility.grade_levels must be an array`);
  } else {
    for (const g of elig.grade_levels) {
      if (!VALID_GRADE_LEVELS.has(g)) warn(`${where}: unknown grade level "${g}"`);
    }
  }

  if (!Array.isArray(elig.states)) {
    err(`${where}: eligibility.states must be an array (empty means nationwide)`);
  }

  if (elig.gpa_min !== undefined && elig.gpa_min !== null) {
    if (typeof elig.gpa_min !== 'number') {
      err(`${where}: eligibility.gpa_min must be a number or null`);
    } else if (elig.gpa_min < 0 || elig.gpa_min > 5) {
      err(`${where}: eligibility.gpa_min ${elig.gpa_min} is outside 0 to 5`);
    }
  }

  if (elig.majors !== undefined && elig.majors !== null) {
    if (!Array.isArray(elig.majors)) {
      err(`${where}: eligibility.majors must be an array or null`);
    } else {
      for (const m of elig.majors) {
        if (!VALID_MAJORS.has(m)) warn(`${where}: unknown major "${m}"`);
      }
    }
  }

  if (elig.ethnicity !== undefined && elig.ethnicity !== null && !Array.isArray(elig.ethnicity)) {
    err(`${where}: eligibility.ethnicity must be an array or null`);
  }

  for (const flag of ['financial_need', 'first_gen', 'military', 'community_service', 'athletics']) {
    if (elig[flag] !== undefined && typeof elig[flag] !== 'boolean') {
      err(`${where}: eligibility.${flag} must be a boolean when present`);
    }
  }

  if (elig.gender !== undefined && elig.gender !== null && typeof elig.gender !== 'string') {
    err(`${where}: eligibility.gender must be a string or null`);
  }
}

function validate(payload) {
  if (typeName(payload) !== 'object') {
    err(`Root must be an object, got ${typeName(payload)}`);
    return { total: 0, expired: 0 };
  }

  if (typeof payload.version !== 'number' || !Number.isInteger(payload.version) || payload.version < 1) {
    err('Root "version" must be a positive integer');
  }

  if (!isIsoDate(payload.updatedAt)) {
    err(`Root "updatedAt" must be a YYYY-MM-DD date, got ${JSON.stringify(payload.updatedAt)}`);
  }

  if (!Array.isArray(payload.scholarships)) {
    err('Root "scholarships" must be an array');
    return { total: 0, expired: 0 };
  }

  if (payload.scholarships.length === 0) {
    err('Root "scholarships" is empty. The app would show nothing.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seenIds = new Map();
  let expired = 0;

  payload.scholarships.forEach((entry, i) => {
    const where = `scholarships[${i}]${entry && entry.id !== undefined ? ` (id ${entry.id})` : ''}`;

    if (typeName(entry) !== 'object') {
      err(`${where}: entry must be an object, got ${typeName(entry)}`);
      return;
    }

    for (const [field, expected] of Object.entries(REQUIRED)) {
      if (entry[field] === undefined || entry[field] === null) {
        err(`${where}: missing required field "${field}"`);
      } else if (typeof entry[field] !== expected) {
        err(`${where}: "${field}" must be ${expected}, got ${typeName(entry[field])}`);
      }
    }

    if (typeof entry.id === 'number') {
      if (!Number.isInteger(entry.id) || entry.id < 1) {
        err(`${where}: "id" must be a positive integer`);
      }
      if (seenIds.has(entry.id)) {
        err(`${where}: duplicate id ${entry.id}, first seen at scholarships[${seenIds.get(entry.id)}]`);
      } else {
        seenIds.set(entry.id, i);
      }
    }

    if (typeof entry.name === 'string' && entry.name.trim() === '') {
      err(`${where}: "name" is blank`);
    }

    if (typeof entry.amount === 'number' && entry.amount < 0) {
      err(`${where}: "amount" cannot be negative`);
    }

    if (typeof entry.deadline === 'string') {
      if (!isIsoDate(entry.deadline)) {
        err(`${where}: "deadline" must be a YYYY-MM-DD date, got "${entry.deadline}"`);
      } else {
        const due = new Date(`${entry.deadline}T00:00:00`);
        if (due < today) {
          expired += 1;
          warn(`${where}: deadline ${entry.deadline} has already passed. Refresh or remove "${entry.name}".`);
        }
      }
    }

    if (typeof entry.url === 'string' && !isWellFormedUrl(entry.url)) {
      err(`${where}: "url" is not a well-formed http or https URL: "${entry.url}"`);
    }

    if (!Array.isArray(entry.tags)) {
      err(`${where}: "tags" must be an array`);
    } else if (entry.tags.some((t) => typeof t !== 'string')) {
      err(`${where}: "tags" must contain only strings`);
    }

    validateEligibility(entry.eligibility, where);
  });

  return { total: payload.scholarships.length, expired };
}

async function loadPayload(args) {
  const urlIndex = args.indexOf('--url');
  if (urlIndex !== -1) {
    const url = args[urlIndex + 1];
    if (!url) throw new Error('--url needs a URL after it');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    return { source: url, payload: await res.json() };
  }

  const positional = args.find((a) => !a.startsWith('--'));
  const path = positional ? resolve(positional) : join(HERE, 'scholarships.json');
  return { source: path, payload: JSON.parse(await readFile(path, 'utf8')) };
}

async function main() {
  const args = process.argv.slice(2);

  let source;
  let payload;
  try {
    ({ source, payload } = await loadPayload(args));
  } catch (e) {
    console.error(`FAIL  Could not read the dataset: ${e.message}`);
    process.exit(1);
  }

  const { total, expired } = validate(payload);

  console.log('ScholarMe dataset validation');
  console.log(`  source     ${source}`);
  console.log(`  version    ${payload?.version ?? 'missing'}`);
  console.log(`  updatedAt  ${payload?.updatedAt ?? 'missing'}`);
  console.log(`  entries    ${total}`);
  console.log(`  expired    ${expired}`);
  console.log('');

  if (warnings.length) {
    console.log(`WARNINGS (${warnings.length})`);
    for (const w of warnings) console.log(`  - ${w}`);
    console.log('');
  }

  if (errors.length) {
    console.log(`ERRORS (${errors.length})`);
    for (const e of errors) console.log(`  - ${e}`);
    console.log('');
    console.log('FAIL  Do not publish this file.');
    process.exit(1);
  }

  console.log(warnings.length ? 'PASS  Publishable, but review the warnings above.' : 'PASS  No problems found.');
}

main();
