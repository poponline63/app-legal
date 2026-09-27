# Weekly Scholarship Discovery — Playbook

You are running the automated weekly scholarship discovery job for ScholarMe. Goal: find REAL new US scholarships, verify them hard, push the survivors live, and report what you did. Students see this data — a fake or dead entry is worse than no entry. Verify everything.

Repo: `C:\Users\popon\Desktop\Claude Code\recovered-apps\app-legal` (hosted data) + `..\scholarme\src\data\scholarships.json` (bundled). Work dir for candidates: `..\scholarme` scratch is fine, or a temp `discover-run` folder next to this file.

## Steps

1. **Pick beats.** Read `discover/beats.json`. Take 5 beats starting at `cursor` (wrap around the array). For the `local-backlog` beat, use the next 3 states from `stateRotation` starting at `cursor % length`. Note which beats you picked.

2. **Spawn 5 research agents** (general-purpose, run_in_background, one per beat). Each MUST:
   - Find REAL, currently-live scholarships for its beat via web search + fetching pages. Never invent name/URL/amount/deadline. URL must be a real page the agent saw.
   - NO lead-gen/sweepstakes (bold.org, niche.com, scholarshipowl, appily, going-merry, survey farms).
   - Emit the exact app schema (see the id:0 template in any prior state agent prompt, or `data/scholarships.json`): national beats use `"states": []`; the local beat uses `["<State>"]`. Roll passed 2026 deadlines to the next cycle + tag `deadline-approx`.
   - WRITE a bare JSON array to `discover-run/<beat-key>.json` and reply with just the count.
   - Target 25-40 each.

3. **Gate.** Run `node data/discover-verify.mjs discover-run`. It drops lead-gen, dedups against all live, fetches each URL, and confirms the page text actually mentions the scholarship. Output: `passed.json` (publishable) + `quarantine.json` (blocked / no-match).

4. **Recovery pass (optional, cheap).** For quarantine entries that were 403/timeout (site up but blocked the checker), spawn ONE agent to re-confirm they are real via browser-style fetch. Append confirmed ones to `passed.json`. Drop the rest.

5. **Cap.** If `passed.json` has more than 150, keep the first 150 (safety ceiling; log that you trimmed).

6. **Merge + verify.** `node data/merge-discovery.mjs discover-run/passed.json` (merges into both datasets, bumps hosted version). Then roll deadlines, `node data/validate-scholarships.mjs` (must say Publishable), and `cd ../scholarme && npx tsc --noEmit` (must be clean). If validate or tsc fails, DO NOT push — report the failure instead.

7. **Push both repos.** Commit scholarme (bundled) + app-legal (hosted) with a message naming the beats and counts. Push both.

8. **Advance cursor.** Set `beats.json` cursor to `(cursor + 5) % beats.length` and commit it with app-legal.

9. **Digest.** Write `discover/last-digest.md` with: date, beats run, found / lead-gen-dropped / deduped / passed / quarantined, new total, hosted version, commit hash, and a revert line (`git revert <hash> && git push`). If `discover/digest-config.json` exists with a `webhookUrl`, POST the digest to that Discord webhook as an embed. Otherwise the task-completion notification is the digest.

## Rules
- Verified-real only. When in doubt, drop it — quarantine is not a push.
- Never push if validate or tsc fails.
- One run = one commit per repo, fully revertible. The digest always names the revert command.
- No dashes in any scholarship description (house style).

## Run notes (learned the hard way)

- **Both datasets, always.** `merge-discovery.mjs` writes hosted and bundled together. A run that hand-edits only `scholarme/src/data/scholarships.json` leaves installed apps on the old list, because the app fetches the hosted file and the bundle only ships with a new build. After any merge, confirm `data/scholarships.json` and the bundled copy hold the same entry count.
- **Carry-in batches.** A run that dies before the merge leaves `passed.json` on disk. The next run should re-gate that batch (the gate re-fetches every URL and dedupes against live data) rather than re-research the same beats, then merge it together with its own fresh candidates.
- **The 150 cap trims.** With two batches the total easily exceeds 150. Keep the trim balanced, 30 per beat, and write the remainder to `discover-run/<run>/carryover.json` so the next run starts from gated candidates.
- **Validator warnings are still content bugs.** `validate-scholarships.mjs` warns, not errors, on past deadlines and unknown grade-level slugs, so it can print PASS while the list is stale or unmatchable. Roll passed deadlines to the next cycle with the `deadline-approx` tag, and use only the slugs in `data/validate-scholarships.mjs` (`high_school_junior` upward; there is no `high_school_freshman` or `high_school_sophomore`).
- **Legacy lead-gen rows.** The blocklist only guards new candidates, so old bold.org / niche.com / scholarshipowl rows survive in the live list. Sweep for them and drop them; students should not be routed to data-harvest sites.
- **This cron's own prompt is wrong about where the playbook lives.** The job text says "the Obsidian vault under Projects/ScholarMe". The real playbook is this file, `app-legal/discover/PLAYBOOK.md`; the vault note is `wiki/Project-ScholarMe.md` and holds run history, not the procedure.
- **app-legal's remote can move under you.** Push with a fetch first; the repo takes unrelated commits (README, policy pages) between runs, so `git pull --rebase origin main` before pushing is the normal path.
- **Always run the recovery pass, and run it before the cap.** Roughly one in ten candidate URLs comes back 403 to the gate (Cloudflare), and most of those are real: on 2026-09-27 fifteen blocked candidates went to a browser re-check and eleven were confirmed. Do the recovery pass, then cap the combined set at 150, then merge. Capping first and merging the recovery batch after pushes the run over the ceiling.
- **Use `data/roll-deadlines.mjs` for the post-merge cleanup.** It rolls passed deadlines, sweeps legacy lead-gen rows, sets `updatedAt`, and refuses to finish if hosted and bundled diverge. Hand-rolling this each week is how the 2026-09-13 run ended up writing only the bundled copy.
- **Redirect gate output to a file, do not pipe it through `tail`.** A backgrounded `node data/discover-verify.mjs ... | tail -25` in this shell dies with `stdin is not a tty` before the gate writes anything, which looks exactly like a clean run that found nothing.
- **Research agents leave a `verify/store.json` page cache in the repo root.** It is a run artifact; `verify/` is in `.gitignore` now, so leave it alone rather than committing it.
- **Don't touch `scholarme/src/utils/matcher.ts`.** Other lanes keep uncommitted work in that file. Stage `src/data/scholarships.json` by name when committing the bundle so their edits stay in the working tree.
