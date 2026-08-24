// Domain coverage scan for remaining recovery candidates
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const live = JSON.parse(readFileSync(join(HERE, '../data/scholarships.json'), 'utf8')).scholarships;

const probes = [
  ['dar.org', /dar\.org/i],
  ['good citizen', /good citizen/i],
  ['4-h', /4-h\.org|4-h\b/i],
  ['hillel', /hillel/i],
  ['peo', /peointernational|P\.E\.O/i],
  ['aiga', /aiga|worldstudio/i],
  ['dairyshrine', /dairyshrine|dairy shrine/i],
  ['sar.org oration', /sar\.org.*oration|rumbaugh|oration contest/i],
];
for (const [label, re] of probes) {
  const hits = live.filter((s) => re.test(s.name) || re.test(s.url) || re.test(s.organization || ''));
  console.log('===', label, hits.length);
  for (const h of hits.slice(0, 6)) console.log('  ', h.id, '|', h.name.slice(0, 55), '|', h.url.slice(0, 70));
}
