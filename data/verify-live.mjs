#!/usr/bin/env node
/**
 * Freshness check for data/scholarships.json.
 *
 * The structural validator (validate-scholarships.mjs) proves the file is
 * well-formed. This proves the CONTENT is still alive: every application URL
 * still resolves, and no listing is quietly past its deadline. Scholarship
 * sites go dead and deadlines pass silently; a stale list is the fastest way to
 * lose a student's trust, so this runs monthly and reports what has rotted.
 *
 *   node data/verify-live.mjs                 # check the local file
 *   node data/verify-live.mjs --json out.json # also write a machine report
 *
 * Always exits 0 (a dead link is news, not a build failure). The CI job reads
 * the report and opens a pull request; a human decides what to fix. No deps.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, 'scholarships.json');
const CONCURRENCY = 8;
const TIMEOUT_MS = 12000;
const UA = 'ScholarMeLinkCheck/1.0 (+https://poponline63.github.io/app-legal)';

const jsonFlagIndex = process.argv.indexOf('--json');
const jsonOut = jsonFlagIndex >= 0 ? process.argv[jsonFlagIndex + 1] : null;

async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Some hosts reject HEAD; fall back to a ranged GET.
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': UA } });
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': UA, range: 'bytes=0-2048' } });
    }
    return { ok: res.status >= 200 && res.status < 400, status: res.status, finalUrl: res.url };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.name === 'AbortError' ? 'timeout' : e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

function toISO(d) {
  return new Date(d).toISOString().slice(0, 10);
}

const raw = await readFile(FILE, 'utf8');
const parsed = JSON.parse(raw);
const list = Array.isArray(parsed) ? parsed : parsed.scholarships || parsed.data || [];
const today = toISO(Date.now());

const results = await mapLimit(list, CONCURRENCY, async (s) => {
  const link = await checkUrl(s.url);
  const past = s.deadline && !Number.isNaN(Date.parse(s.deadline)) && toISO(s.deadline) < today;
  const redirected = link.finalUrl && link.finalUrl.replace(/\/$/, '') !== String(s.url).replace(/\/$/, '');
  return { id: s.id, name: s.name, url: s.url, deadline: s.deadline, link, past, redirected };
});

// A 404/410 is genuinely gone and worth fixing. A 403/401/429/timeout usually
// means the site is UP but blocking an automated request (bot protection) — it
// works fine in a browser — so those go in a separate "verify manually" bucket
// instead of being cried as dead.
const isBroken = (r) => !r.link.ok && (r.link.status === 404 || r.link.status === 410);
const isBlocked = (r) => !r.link.ok && !isBroken(r);
const broken = results.filter(isBroken);
const blocked = results.filter(isBlocked);
const expired = results.filter((r) => r.past);
const moved = results.filter((r) => r.link.ok && r.redirected);

const report = {
  checkedAt: today,
  total: list.length,
  broken: broken.length,
  needsManualCheck: blocked.length,
  expired: expired.length,
  redirected: moved.length,
  brokenList: broken.map((r) => ({ id: r.id, name: r.name, url: r.url, status: r.link.status })),
  blockedList: blocked.map((r) => ({ id: r.id, name: r.name, url: r.url, status: r.link.status, error: r.link.error })),
  expiredList: expired.map((r) => ({ id: r.id, name: r.name, deadline: r.deadline })),
  redirectedList: moved.map((r) => ({ id: r.id, name: r.name, from: r.url, to: r.link.finalUrl })),
};

const lines = [
  `# Scholarship freshness report (${today})`,
  '',
  `- Checked: **${report.total}**`,
  `- Broken (404/410, fix these): **${report.broken}**`,
  `- Needs a manual look (403/timeout, likely bot-blocked): **${report.needsManualCheck}**`,
  `- Past deadline: **${report.expired}**`,
  `- Redirected (URL moved): **${report.redirected}**`,
  '',
];
if (broken.length) {
  lines.push('## Broken (404/410 — fix or remove)');
  broken.forEach((r) => lines.push(`- [${r.id}] ${r.name} — ${r.link.status} — ${r.url}`));
  lines.push('');
}
if (blocked.length) {
  lines.push('## Verify manually (site likely up but blocked the checker)');
  blocked.forEach((r) => lines.push(`- [${r.id}] ${r.name} — ${r.link.status || r.link.error} — ${r.url}`));
  lines.push('');
}
if (expired.length) {
  lines.push('## Past deadline (update to next cycle)');
  expired.forEach((r) => lines.push(`- [${r.id}] ${r.name} — was ${r.deadline}`));
  lines.push('');
}
if (moved.length) {
  lines.push('## URL moved (consider updating)');
  moved.forEach((r) => lines.push(`- [${r.id}] ${r.name} — ${r.url} → ${r.link.finalUrl}`));
  lines.push('');
}

const md = lines.join('\n');
console.log(md);
if (jsonOut) {
  await writeFile(jsonOut, JSON.stringify(report, null, 2));
  await writeFile(join(HERE, 'freshness-report.md'), md);
}

process.exit(0);
