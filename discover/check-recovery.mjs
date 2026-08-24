// Check recovery candidates against live dataset for near-duplicates
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const q = JSON.parse(readFileSync(join(HERE, 'quarantine-dryrun.json'), 'utf8'));
const live = JSON.parse(readFileSync(join(HERE, '../data/scholarships.json'), 'utf8')).scholarships;

const keep = [
  'https://www.dar.org/national-society/scholarships/dar-related',
  'https://www.kiwanis.org/who-we-are/kiwanis-childrens-fund/scholarship-opportunities/',
  'https://4-h.org/programs/4-h-youth-in-action-program/',
  'https://www.hillel.org/jewish-scholarships-portal/',
  'https://www.dar.org/national-society/scholarships/nursing-medical-scholarships',
  'https://www.hsf.net/scholarship/',
  'https://nfb.org/scholarships',
  'https://www.peointernational.org/educational-support/star-scholarship/',
  'https://thegatesscholarship.org/scholarship',
  'https://bhw.hrsa.gov/programs/nurse-corps/scholarship/apply',
  'https://www.americanbar.org/groups/diversity/diversity_pipeline/projects_initiatives/legal_opportunity_scholarship/',
  'https://dairyshrine.org/national-dairy-shrine-scholarships-2025/',
  'https://www.aiga.org/competitions-initiatives/aiga-worldstudio-dd-scholarships',
  'https://www.sar.org/education/youth-contests/',
];

const norm = (n) => n.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
for (const k of keep) {
  const e = q.find((x) => x.url === k);
  if (!e) { console.log('MISSING', k); continue; }
  const words = new Set(norm(e.name).split(/\s+/).filter((w) => w.length > 3));
  const clash = live.filter((s) => {
    const sw = norm(s.name).split(/\s+/);
    const overlap = sw.filter((w) => words.has(w)).length;
    return overlap >= Math.min(3, words.size) || (s.url.replace(/\/$/, '') === k.replace(/\/$/, ''));
  });
  console.log(e.name.slice(0, 48), '->', clash.length ? clash.map((c) => c.id + ':' + c.name.slice(0, 40)).join(' ; ') : 'unique');
}
