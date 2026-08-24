// Build recovered.json from verified quarantine survivors
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const q = JSON.parse(readFileSync(join(HERE, 'quarantine-dryrun.json'), 'utf8'));

const picks = [
  ['https://www.dar.org/national-society/scholarships/dar-related', null],
  ['https://www.dar.org/national-society/scholarships/nursing-medical-scholarships', null],
  ['https://4-h.org/programs/4-h-youth-in-action-program/', null],
  ['https://www.hillel.org/jewish-scholarships-portal/', null],
  ['https://www.peointernational.org/educational-support/star-scholarship/', null],
  ['https://www.aiga.org/competitions-initiatives/aiga-worldstudio-dd-scholarships', null],
  ['https://dairyshrine.org/national-dairy-shrine-scholarships-2025/', 'https://dairyshrine.org/youth/'],
  ['https://www.sar.org/education/youth-contests/', 'https://www.sar.org/joseph-s-rumbaugh-historical-oration-contest/'],
];

const out = [];
for (const [oldUrl, newUrl] of picks) {
  const e = q.find((x) => x.url === oldUrl);
  if (!e) { console.error('MISSING', oldUrl); process.exit(1); }
  const { source_note, __beat, __verdict, __status, __error, ...clean } = e;
  if (newUrl) clean.url = newUrl;
  // nursing maps to the healthcare major enum
  if (Array.isArray(clean.eligibility?.majors)) {
    clean.eligibility.majors = clean.eligibility.majors
      .map((m) => (m.toLowerCase() === 'nursing' ? 'healthcare' : m.toLowerCase()))
      .filter((m) => ['stem','business','arts','healthcare','education','law','engineering','computer_science','liberal_arts','undecided'].includes(m));
    if (!clean.eligibility.majors.length) clean.eligibility.majors = null;
  }
  out.push(clean);
}
writeFileSync(join(HERE, 'recovered.json'), JSON.stringify(out, null, 2) + '\n');
console.log('wrote', out.length, 'recovered entries');
for (const e of out) console.log(' -', e.name);
