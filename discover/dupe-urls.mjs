// Exact dupe check: candidate URLs/names vs the specific live entries flagged above
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const live = JSON.parse(readFileSync(join(HERE, '../data/scholarships.json'), 'utf8')).scholarships;

const ids = [287, 308, 418, 560, 244, 828, 84, 110, 3, 307];
for (const id of ids) {
  const s = live.find((x) => x.id === id);
  if (s) console.log(id, '|', s.name, '|', s.url);
}
