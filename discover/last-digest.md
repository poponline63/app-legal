# Weekly Scholarship Discovery Digest

**Run date:** 2026-09-20
**Beats run (cursor 0 → 5):** majors-health-eng, identity-ethnicity, civic-service, local-backlog (California, Texas, Florida), majors-business-law-edu
**Commit:** e86c56b4c6ad3b4b43ddaf178042c66ee3d89cdb (app-legal) + c788b42 (scholarme bundled)
**Revert:** `git revert e86c56b && git push` (app-legal) and `git revert c788b42 && git push` (scholarme)

## Pipeline numbers

Two candidate sets were gated this run.

**A. Carry-in batch from the 2026-09-06 run (never merged), re-verified today**

- Candidates found: 176
- Lead-gen dropped: 0
- Already in the live list: 28
- Checked live: 148
- Passed (publishable): 123
- Quarantined (blocked or no page-text match): 25
- Dead (404/410): 0

**B. Fresh research for this run, five beats**

- Candidates found: 137
- Lead-gen dropped: 0
- Already in the live list: 22
- Checked live: 115
- Passed (publishable): 105
- Quarantined: 9
- Dead (404/410): 1

**Combined**

- Unique passed after cross-set and live dedupe: 218
- Cap applied: kept 150 (30 per beat, fresh and carry-in alternated), 68 held in `discover-run/wk20260920/carryover.json` for the next run
- **Published this run: 150**

## Dataset state

- Hosted entries: 2006 → **2112**
- Hosted version: 25 → **26**
- Bundled (scholarme) entries: 2024 → **2112** (now identical to hosted)
- Expired entries: 0
- `node data/validate-scholarships.mjs`: PASS, no problems
- `npx tsc --noEmit` (scholarme): clean

## Cleanups folded into the same commit

- **52 legacy lead-gen rows removed** (bold.org, niche.com, scholarshipowl, appily, unigo). These predate the discovery blocklist and the 2026-09-13 run added one more. Students should not be routed to data-harvest sites.
- **18 rows synced from bundled to hosted.** The 2026-09-13 run wrote only the bundled copy, so installed apps never received those 18. Hosted and bundled are now byte-identical in content.
- **10 duplicate rows removed** (same name and URL, different ids), keeping the most recently verified copy.
- **23 deadlines rolled** from a passed 2026 date to the equivalent 2027 date, each tagged `deadline-approx`.
- **6 entries had invalid grade-level slugs** (`high_school_freshman`, `high_school_sophomore`, which the app enum does not carry); the invalid values were dropped.

## Notes for the next run

- `discover/beats.json` cursor is now 5, so the next run covers identity-women-disability-lgbtq, noessay, majors-ag-trades-arts, identity-military-immigrant-religious, employer-union.
- `discover-run/wk20260920/carryover.json` holds 68 already-gated candidates that the 150 cap trimmed. Feed them through the gate again rather than re-researching those beats.
- `discover/digest-config.json` does not exist, so no Discord webhook was posted.
