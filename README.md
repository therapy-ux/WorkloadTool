# Service Coordinator Task Management Tool

A daily operations tool for a home care Service Coordinator. It reads the operational
spreadsheet, works out what needs doing today, and presents it as an ordered queue.

**The goal it is built around:** she should never have to work out what to do next.
She opens the tool, works down the list, records what happened, and moves on.

<!-- Add a screenshot here once deployed: ![Screenshot](docs/screenshot.png) -->

---

## What it does

Reads a Google Sheet and **generates tasks automatically** — nothing is created by hand:

| Task | Trigger |
|---|---|
| **NOTHING BOOKED** | An active patient with no upcoming visit at all — the most expensive state a patient can be in |
| **Will miss 2 this week** | The week will end below the 2-visit minimum unless something is booked |
| **Above 3 / week** | Over the maximum — check the authorisation covers it |
| **Feedback call** | After the initial visit, then at visits 4, 9, 14, 19 … |
| **Confirm date** | An appointment tomorrow with no confirmation recorded (date only — no time) |
| **Note overdue / due soon** | A completed visit with no finalised note against a 48-hour deadline |
| **Low units** | A note carrying fewer than 4 units |
| **Copay** | An outstanding balance, aggregated into one task per patient |
| **Add patient / missing phone** | An active patient absent from the Home Care Patients tab, or with no number |
| **Appointment status** | A past appointment whose outcome was never recorded |
| **Retention** | Not seen recently, or appears to have stopped |
| **System alert** | A condition affecting most of the caseload, rolled up into one row instead of dozens |

**Payment status is read exactly as the sheet means it.** *No Payment* = the patient owes
**$0** because insurance covers the visit — a settled row, never a gap in the data. An
*Amount* against Copay / Deductible / Self pay = what the patient owes. Only `#N/A` counts as
missing, and it is reported on Data health rather than chased. Details in
[docs-src/TASK_RULES.md](docs-src/TASK_RULES.md#4-copay--high-when-overdue).

Seven screens:
* **My day** — the queue, in Overdue / Due today / Upcoming / Completed.
* **Scheduling** — the command centre for the 2–3 visits/week rule: who has nothing booked,
  who will finish the week short, and exactly how many visits each one still needs.
* **No upcoming visit** — every active patient with nothing on the books: therapist, last
  completed visit, days since, visits delivered, weekly average, phone. Derived from the sheet
  on every refresh, so there is no list to maintain and it cannot go stale.
* **Therapist follow-ups** — one button groups every therapist-owned problem by therapist,
  writes each therapist a message containing only their own patients, logs it, and holds the
  self-maintaining response checklist (⚪ / 🔵 / 🔴 / 🟡 / 🟢). Items mark themselves resolved
  when the underlying problem disappears from the sheet. See
  **[docs-src/THERAPIST_FOLLOWUPS.md](docs-src/THERAPIST_FOLLOWUPS.md)**.
* **Patients** — everything open for one patient in one place, so she calls once, not four times.
* **Manager view** — completion rate, what is overdue, **why work was not finished**, which
  patients need attention, recurring problems, and trends by day, week and month.
* **Data health** — which fields are present, which features are switched off for want of a
  column, and what was skipped while parsing.

**Publishing to GitHub:** four steps in **[PUBLISH.md](PUBLISH.md)** — all from the GitHub
website, no command line and no build step. `docs/index.html` is the prebuilt site; Pages
serves it directly from the branch. — push, turn Pages on,
paste your four sheet links into the app's first screen.

The deployed bundle contains **no sheet links and no patient data**. Links are entered in the
app and kept in that browser, so a published site is an empty tool until someone who has them
types them in. CI fails the build if a link is ever compiled in.

## Quick start

```bash
git clone <your-repo-url>
cd service-coordinator-tool
npm install
npm run dev            # runs on synthetic demo data — no setup needed
```

Then connect a real sheet:
```bash
cp .env.example .env.local
# set VITE_DATA_SOURCE=google and VITE_SHEET_ID=<your sheet id>
```
Full walkthrough: **[docs-src/GOOGLE_SHEETS_SETUP.md](docs-src/GOOGLE_SHEETS_SETUP.md)**

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run build:single` | One self-contained HTML file (demo data) for sharing a preview |
| `npm test` | 58 tests — 48 unit, 10 against the live published sheet |
| `npm run fetch:live` | Downloads the published tabs to `/tmp/live` so the live tests can run |
| `npm run typecheck` | TypeScript, strict mode |

## Deployment

**GitHub Pages** — enable Pages (source: GitHub Actions). The included workflow builds and
deploys on push to `main`. Set repository *Variables* (Settings → Secrets and variables →
Actions → Variables): `SHEET_ID`, and optionally `TAB_*` and `TASK_WRITE_URL`.

**Vercel / Netlify / Cloudflare Pages** — build `npm run build`, publish `dist`. Add the
`VITE_*` values as environment variables.

**Any static host** — `npm run build` and upload `dist/`. It is a static bundle; there is no server.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_DATA_SOURCE` | no | `demo` (default) or `google` |
| `VITE_URL_APPOINTMENTS` | for real data | Published CSV URL for the Scheduled Visits tab |
| `VITE_URL_NOTES` / `_CLAIMS` / `_PATIENTS` | for real data | Published CSV URLs for the other three tabs |
| `VITE_SHEET_ID` | alternative | Spreadsheet id, if you prefer the gviz endpoint |
| `VITE_TAB_*` | no | Tab names when using the gviz endpoint |
| `VITE_TASK_WRITE_URL` | no | Apps Script endpoint so progress is shared across devices |
| `BASE_PATH` | Pages only | `/<repo-name>/` for a project site |

> **`VITE_*` values are compiled into the public bundle and are readable by anyone.**
> They are configuration, never secrets. See [docs-src/DATA_PRIVACY.md](docs-src/DATA_PRIVACY.md).

## Privacy — read before using real data

There are **no credentials in this repository** and none are needed: the app reads a
link-shared sheet through Google's public CSV endpoint.

But a link-shared Google Sheet is published to the internet. That is acceptable for demo or
de-identified data and **is not acceptable for real patient records**. The code is arranged so
that swapping in a private source later means writing one class — not rebuilding the app.
The reasoning and the migration path are in **[docs-src/DATA_PRIVACY.md](docs-src/DATA_PRIVACY.md)**.

## Architecture

```
src/
  config/rules.ts        every threshold, in one file
  data/                  DataSource interface + Google Sheets and Demo implementations
  engine/                the task engine — pure functions, fully tested
  store/                 where her progress is saved (local, or Apps Script)
  views/                 the seven screens
  lib/                   timezone, CSV, stable ids
apps-script/Code.gs      optional write endpoint
docs-src/                analysis, sheet template, task rules, therapist follow-ups, privacy
docs/index.html          the built site GitHub Pages serves
```

Three deliberate decisions:

1. **`src/config/rules.ts` holds every number.** Visit targets, the 48-hour deadline, the
   10:00 cutoff, every threshold. Change a value and the whole engine follows.
2. **The engine is a pure function.** `generateTasks(snapshot, clock) → tasks`. No I/O, no
   randomness. Same data and clock always produce the same list with the same ids — which is
   why her progress survives a refresh and why the manager sees exactly what she sees.
3. **`DataSource` is the only seam that touches Google.** Everything else consumes a
   `Snapshot`. That is what makes the privacy migration a one-file change.

## Known limitations of Google Sheets as the data source

| Limitation | Consequence | Mitigation |
|---|---|---|
| Read-only over the public endpoint | Progress cannot be written to the sheet | Local storage by default; optional Apps Script endpoint |
| Public link sharing | Unsuitable for real patient data | See DATA_PRIVACY.md; swap the `DataSource` |
| No schema enforcement | A renamed column silently breaks a feature | Data health screen reports coverage and parse failures |
| Google caches gviz output | Edits take up to ~30s to appear | **Refresh data** button |
| Whole sheet loads into the browser | Slows past roughly 20–50k rows | Archive old rows; move to a real database |
| No concurrency control | Two people editing can overwrite each other | Keep the sheet to one owner |
| No audit trail | Cannot see who changed what | A database with row history |

The honest summary: this architecture is right for one coordinator and a few thousand rows.
It is a starting point with a documented exit, not a permanent platform.

## Analysis of the source workbook

The full profiling of `Home Care Workload tool 1.xlsx` — existing columns, what they support,
what is missing, and the data quality problems to fix at source — is in
**[docs-src/DATA_ANALYSIS.md](docs-src/DATA_ANALYSIS.md)**.

Findings that shaped the build, updated for the August 2026 sheet:
1. **Phone numbers now exist** — 132 of 135 patients on the Home Care Patients tab. This was
   the single biggest blocker in the previous version and it is resolved.
2. **Units are usable** — the 4-unit minimum is enforced against real data. 379 empty trailing
   rows carry a units value of 0 and are correctly ignored rather than flagged.
3. **Appointment times are no longer needed** for confirmations, which are now date-only.
   They still matter for note deadlines, which are measured from an assumed midday and say so.
4. **The sheet is still a historical log, not a forward schedule.** Zero rows are dated today
   or later, so 74 of 74 active patients read as "nothing booked". The engine rolls that into
   one system alert rather than 74 identical red rows.

The app does not paper over any of this. Missing data suppresses a task and is reported on the
**Data health** screen, so an empty queue can always be told apart from a missing column.

## License

MIT — see [LICENSE](LICENSE).
