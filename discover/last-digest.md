# Weekly Scholarship Discovery Digest

**Run date:** 2026-11-09
**Beats run (cursor 0 → 5):** majors-health-eng, identity-ethnicity, civic-service, local-backlog, majors-business-law-edu
**Commits:** `4f68e18` (app-legal, hosted data + cursor) and `dc5dabe` (scholarme, bundled data)
**Revert:** `git revert 4f68e18 && git push` (app-legal) and `git revert dc5dabe && git push` (scholarme). The digest commit that follows `4f68e18` only adds this file, so reverting the two above restores the previous list exactly.

## Pipeline numbers

Three candidate sets were gated this run: the carry-in batch, the pre-gated batch from the prior run's `passed.json`, and fresh research across five beats. A browser recovery pass followed the gate.

- Candidates found: 88 (39 carry-in + 35 pre-gated + 14 fresh)
- Lead-gen dropped: 0
- Already in the live list / cross-set dedup: 24 (the pre-gated batch overlapped the carry-in batch; both descend from the 2026-09-06 research set)
- Checked live: 64
- Passed (publishable): 61
- Quarantined (blocked or no page-text match): 3
- Dead (404/410): 0

**Recovery pass** re-confirmed 2 of the 3 quarantined entries via browser-style fetch and merged them back (IEEE MTT-S Undergraduate/Pre-Graduate Scholarships, ASHRAE Undergraduate Engineering Scholarships). One was dropped: Gus Archie Memorial Scholarship (spe.org failed to fetch in both the gate and the recovery check).

**Merged total: 63** (61 gated + 2 recovered). Hosted version 29 → 30, total 2,111 → 2,174. Both datasets hold 2,174 entries.

## Fresh research (5 beats, 14 candidates, 14 passed)

- identity-ethnicity: 5 → 5 (Freemont Foundation, HBCU Week NFL, Mary Mahoney Detroit, Hozho Foundation, Dakota Indian Foundation)
- local-backlog: 6 → 6 (Ventura County CF, Yolo CF, Tri Counties Bank, Sierra Central, Collaboratory, JILK Family)
- civic-service: 1 → 1 (Kansas 4-H)
- majors-business-law-edu: 1 → 1 (WICPA Educational Foundation)
- majors-health-eng: 1 → 1 (ELEVATE Nephrology Nursing Education)

## Post-merge cleanup

- `roll-deadlines.mjs`: rolled 16 passed deadlines to the next cycle (e.g. IEEE MTT-S, VFW Voice of Democracy, ASHRAE, AGC).
- Fixed one grade-level slug bug on the AAa/e Foundation entry (removed invalid `high_school_freshman` / `high_school_sophomore`) in both datasets.
- `validate-scholarships.mjs`: PASS, no problems. `npx tsc --noEmit`: clean.
- `beats.json` cursor advanced 0 → 5. `scholarme/src/utils/matcher.ts` left untouched (other-lane uncommitted work preserved).

## Notes for the next run

- `discover/beats.json` cursor is now 5, so the next run covers identity-women-disability-lgbtq, noessay, majors-ag-trades-arts, identity-military-immigrant-religious, and employer-union.
- The 150 cap was not reached this run (63 merged), so no carry-over file was written.
- `discover/digest-config.json` does not exist, so no Discord webhook was posted.
