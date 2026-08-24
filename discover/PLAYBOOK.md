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
