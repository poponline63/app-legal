# Weekly Scholarship Discovery Digest

**Run date:** 2026-09-27
**Beats run (cursor 5 → 0):** identity-women-disability-lgbtq, noessay, majors-ag-trades-arts, identity-military-immigrant-religious, employer-union
**Commits:** 52eedad (app-legal, hosted data + script + cursor) and 3ba79a6 (scholarme, bundled data)
**Revert:** `git revert 52eedad && git push` (app-legal) and `git revert 3ba79a6 && git push` (scholarme). The digest commit that follows 52eedad only adds this file, so reverting the two above restores the previous list exactly.

## Pipeline numbers

Two candidate sets were gated this run, plus a browser recovery pass.

**A. Carry-in batch from the 2026-09-20 cap trim (re-gated today)**

- Candidates found: 68
- Lead-gen dropped: 0
- Already in the live list: 0
- Checked live: 68
- Passed (publishable): 67
- Quarantined (blocked or no page-text match): 1
- Dead (404/410): 0

**B. Fresh research for this run, five beats**

- Candidates found: 166
- Lead-gen dropped: 0
- Already in the live list: 33
- Checked live: 133
- Passed (publishable): 113
- Quarantined: 18
- Dead (404/410): 2

By beat (found to passed): identity-women-disability-lgbtq 39 to 29, noessay 32 to 15, majors-ag-trades-arts 27 to 18, identity-military-immigrant-religious 39 to 29, employer-union 29 to 22.

**C. Browser recovery pass**

The gate got blocked (HTTP 403 or bot wall) on 15 candidates, so none could be proven either way. One agent re-opened all 15 in a real browser and read the pages. 11 confirmed and published. 4 dropped:

- Alliant Credit Union Member Scholarship Drawing: its own page calls it a drawing with winners picked at random.
- Text 4000 College Scholarship Sweepstakes (Huntington): a text to win promotion, not a scholarship.
- Citizens Bank Scholarship: monthly random drawing sweepstakes by its official rules, and the site would not load at all.
- First Tech Credit Union Scholarship: firsttechfed.com never loaded across five URL variants, so it stays unverified and unpublished.

**Combined**

- Unique after cross-set and live dedupe: 178
- Cap applied: kept 150 (113 fresh, 26 carry-in, 11 recovered)
- 39 gated candidates held in `discover-run/wk20260927/carryover.json` for the next run
- **Published this run: 150**

## Dataset state

- Hosted entries: 2112 to **2261**
- Hosted version: 26 to **28** (two merge passes, the main batch then the recovery batch)
- Bundled (scholarme) entries: 2112 to **2261** (identical to hosted)
- Expired entries: 0
- `node data/validate-scholarships.mjs`: PASS, no problems
- `node data/validate-scholarships.mjs --url https://poponline63.github.io/app-legal/data/scholarships.json`: PASS, live file serving version 28
- `npx tsc --noEmit` (scholarme): clean

## Cleanups folded into the same commit

- **6 deadlines rolled** from a passed 2026 date to the equivalent 2027 date, each tagged `deadline-approx`: QuestBridge National College Match, Schwarzman Scholars, NRF Foundation University Retail Challenge, and three NAPABA Law Foundation awards.
- **1 legacy lead-gen row dropped**: Regents Scholarship pointed at a fastweb.com page. The university's own pages for it return 404, so the row was removed rather than left routing students to a data-harvest site.
- **New `data/roll-deadlines.mjs`** does both jobs on every run from now on. It rolls passed deadlines and sweeps legacy lead-gen rows across hosted and bundled together, asserts the two stay in step, and sets `updatedAt`. Before this the roll was done by hand each week.

## Notes for the next run

- `discover/beats.json` cursor is now 0, so the next run covers majors-health-eng, identity-ethnicity, civic-service, local-backlog (California, Texas, Florida) and majors-business-law-edu.
- `discover-run/wk20260927/carryover.json` holds 39 already-gated candidates that the 150 cap trimmed. Feed them through the gate again rather than re-researching those beats.
- The research agents left a `verify/store.json` page cache in the repo root. It is a run artifact, so it is now in `.gitignore`.
- `discover/digest-config.json` does not exist, so no Discord webhook was posted.
