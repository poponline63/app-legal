# ScholarMe scholarship dataset

`scholarships.json` is the live scholarship list the ScholarMe iOS app fetches at
launch. Editing this file updates every installed copy of the app without an App
Store release.

Live URL: <https://poponline63.github.io/app-legal/data/scholarships.json>

## Why it lives in this repo

The ScholarMe app repo is private, so free GitHub Pages cannot serve from it.
This repo is public and already publishes to Pages from `main` at root, so the
dataset rides along with the legal pages.

## How the app uses it

1. On launch the app returns whatever it already has cached, instantly.
2. In the background it fetches this file with a short timeout.
3. If the payload parses and passes a shape check, it is cached and used from
   the next read onward.
4. If anything fails, offline, timeout, 404, malformed JSON, the app falls back
   to its bundled copy and shows the student no error.

That last point is the important one. A broken file here does not crash the app,
it silently freezes the list at whatever each student last cached. Nobody
reports the bug. So validate before you push.

## Updating the dataset

1. Edit `scholarships.json`.
2. Bump `version` by one and set `updatedAt` to today in `YYYY-MM-DD` form.
3. Run the validator and fix every error.
4. Commit and push to `main`.
5. Wait up to a minute, then confirm the live URL serves your change.

```bash
node data/validate-scholarships.mjs
git add data/scholarships.json
git commit -m "Update scholarship dataset"
git push
curl -s https://poponline63.github.io/app-legal/data/scholarships.json | head -5
```

## The validator

```bash
node data/validate-scholarships.mjs                  # validate the local file
node data/validate-scholarships.mjs some/other.json  # validate a specific file
node data/validate-scholarships.mjs --url https://poponline63.github.io/app-legal/data/scholarships.json
```

No dependencies, plain Node 18 or newer.

It exits non-zero on hard errors: a missing or wrong-typed required field, a
duplicate `id`, a malformed URL, a bad date, a broken eligibility block, or an
empty list. It only warns about past deadlines and unrecognized grade levels or
majors, because those are stale content rather than a broken file.

## Entry shape

```json
{
  "version": 1,
  "updatedAt": "2026-08-05",
  "scholarships": [
    {
      "id": 1,
      "name": "Coca-Cola Scholars Program",
      "organization": "The Coca-Cola Scholars Foundation",
      "amount": 20000,
      "amountLabel": "$20,000",
      "deadline": "2026-09-30",
      "description": "Achievement-based scholarship for graduating high school seniors.",
      "url": "https://www.coca-colascholarsfoundation.org/apply/",
      "eligibility": {
        "gpa_min": 3,
        "grade_levels": ["high_school_senior"],
        "states": [],
        "ethnicity": null,
        "financial_need": false,
        "first_gen": false,
        "military": false,
        "gender": null,
        "majors": null,
        "community_service": false,
        "athletics": false
      },
      "category": "merit",
      "noEssay": false,
      "renewable": false,
      "tags": ["national", "leadership", "high-value"]
    }
  ]
}
```

Notes on the fields that are easy to get wrong:

- `id` must be unique and stable. The app stores saved and skipped scholarships
  by id, and it flags ids it has never seen as NEW. Reusing an id for a
  different scholarship silently rewrites a student's saved list.
- `amount` is the number used for sorting. `amountLabel` is the string shown on
  screen, so keep the two in agreement.
- `deadline` is `YYYY-MM-DD`. Every countdown and reminder in the app reads it.
- `eligibility.states` empty means nationwide. The legacy sentinel `"all"` is
  also accepted.
- `eligibility.majors` and `eligibility.ethnicity` use `null` for no
  restriction, not an empty array.
- Valid grade levels: `high_school_junior`, `high_school_senior`,
  `college_freshman`, `college_sophomore`, `college_junior`, `college_senior`,
  `grad_student`.
- Valid majors: `stem`, `business`, `arts`, `healthcare`, `education`, `law`,
  `engineering`, `computer_science`, `liberal_arts`, `undecided`.

## Freshness fields

The app tolerates additive fields, so three exist purely to make staleness
visible rather than invisible.

- `deadlinesVerifiedAs` (root, `YYYY-MM`): the month the deadlines in this file
  were last reasoned about. If it is more than a year behind today, treat every
  approximate deadline as untrustworthy.
- `verifiedAt` (per entry, `YYYY-MM-DD`): when that entry's sponsor and URL were
  last checked.
- `deadlineApprox` (per entry, `true` or absent): the sponsor rotates this
  deadline annually and the exact date for the upcoming cycle was not confirmed.
  The value is the sponsor's usual month, set to the next upcoming occurrence.
  Absent means the date was taken from a stated, dated sponsor deadline.

Most entries carry `deadlineApprox`. That is honest rather than sloppy: almost
no sponsor publishes next year's exact date a year ahead. Students should always
be sent to the sponsor page for the real date, which is what the card's link
does.

## Curation rules

The dataset is the product, and a wrong link costs a student a real opportunity.

- Only well-known, legitimate sponsors: major foundations, national
  corporations, professional associations, federal and state agencies,
  established nonprofits.
- Every URL must resolve. Check before publishing. A host that answers 403 to
  scripted requests but is plainly alive in a browser is acceptable; a host that
  does not answer at all is not, and the entry goes.
- Never invent a sponsor, an amount, or a URL. Fewer accurate entries beat more
  shaky ones.
- No pay-to-join honor societies and no lead-generation listings dressed up as
  scholarships.

## Adding a scholarship

Give it the next unused `id`, fill in every required field, and run the
validator. New ids show up in the app with a NEW badge for students who have
opened the app before.
