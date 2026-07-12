# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm test           # Vitest watch mode
npm run test:run   # Vitest single run (CI)
npx tsx ask-pulse-evals/run-evals.ts   # Ask Pulse eval suite (needs OPENAI_API_KEY + SUPABASE_SERVICE_ROLE_KEY)
```

Tests live in `__tests__/` mirroring the source tree. Mock `next/navigation`'s `redirect` to throw so execution stops as in real Next.js: `vi.fn().mockImplementation((url) => { throw new Error(\`NEXT_REDIRECT:\${url}\`) })`.

**Testing is mandatory, not optional.** Every change that adds or modifies logic MUST ship with tests that cover it in the same PR — there is no "I'll add tests later". Specifically:
- **Pure functions / helpers** (anything in `lib/`): unit-test the happy path AND the edge cases (null/empty/invalid input, boundary values, duplicates, sort order). These are cheap and high-value — aim to cover every branch.
- **Server actions**: test auth gating (non-staff/non-admin is rejected), input validation, the success path (assert the DB call args), and error surfacing. Mock `@/lib/auth`, the Supabase client, and `next/cache` (see `__tests__/actions/` for the pattern).
- **Components**: test the rendered states that matter (empty, populated, interaction) where practical.
- Run `npm run test:run` before considering work done; the suite must be green. When you touch existing logic, update or add the tests that cover it.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       # Required for Supabase Storage uploads (JD files, resumes)
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY              # Multiline PEM key
GOOGLE_SHEET_ID
JOOBLE_API_KEY                  # Required for Job Outreach scraper
OPENAI_API_KEY                  # Required for ask-pulse-evals only (evaluation suite)
ANTHROPIC_API_KEY               # Required for Ask Pulse (claude-sonnet-4-6)
GOOGLE_OAUTH_CLIENT_ID          # OAuth 2.0 Web client — for Gmail-based email campaigns (mail-merge)
GOOGLE_OAUTH_CLIENT_SECRET      # paired secret; consent screen needs gmail.send + userinfo.email scopes
EMAIL_FROM_NAME                 # optional From display name; address is always the connected Google account
GOOGLE_ALUMNI_SHEET_ID          # Alumni roster Google Sheet ID
MCP_DATABASE_URL                # Read-only Postgres URL for the MCP server (pulse_mcp_ro role)
                                # Format: postgresql://pulse_mcp_ro:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
                                # See migrations/018_mcp_readonly_role.sql for setup instructions
```

`SUPABASE_SERVICE_ROLE_KEY` must be added manually to Vercel — it is not a `NEXT_PUBLIC_` var and won't be auto-detected.

`MCP_DATABASE_URL` is only needed locally and in any environment running the MCP server. It does not go to Vercel (the MCP server is not deployed there).

## Architecture

### Route Groups

Two top-level route groups with separate layouts and auth contexts:

- **`app/(protected)/`** — Admin and LF users: dashboard, learners, users, placements. Layout at `app/(protected)/layout.tsx` checks `getAppUser()` and redirects learners to `/learner`.
- **`app/(learner)/learner/`** — Learner-facing placement surface: single Dashboard (role feed + filter pills + PlacementSnapshot), role detail, profile/resume. Layout at `app/(learner)/learner/layout.tsx`.

Middleware (`middleware.ts`) enforces authentication on all protected paths and redirects authenticated users away from `/login`. The `protectedPrefixes` array AND the `matcher` config must both be updated when adding new protected routes.

### Identity & Auth

Dual-layer identity:
1. **Supabase Auth** — Google OAuth session; stores email in auth metadata.
2. **`users` table** — App roles (`admin | LF | learner`) and display name.

`getAppUser()` in `lib/auth.ts` (React `cache`-wrapped) looks up the authenticated user's email in the `users` table to get their app role. Every server component and action calls this.

Role enforcement is done in layouts (redirect) and server actions (`requireAdmin()` helper).

In API route handlers, use `createServerSupabaseClient()` directly for auth — do NOT use `getAppUser()`, as React `cache` does not work in route handlers.

### Server Actions Pattern

All mutations use Next.js Server Actions (`'use server'`). Pattern:

```ts
export async function doSomething(formData: FormData) {
  await requireAdmin()                          // role check + redirect
  const supabase = await createServerSupabaseClient()
  await supabase.from('table').insert(...)
  revalidatePath('/affected/path')              // clear Next.js cache
}
```

All pages that read mutable data use `export const dynamic = 'force-dynamic'`.

### Supabase Clients

- `lib/supabase.ts` — browser client (for client components)
- `lib/supabase-server.ts` — server client with SSR cookie handling (for server components and actions)
- For storage operations requiring elevated privileges, create an admin client directly with `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` — see `uploadJdAttachment()` in `app/(protected)/placements/actions.ts`.

### Placements Module

Admin-facing (`app/(protected)/placements/`) and learner-facing (`app/(learner)/learner/`) share the same Supabase tables:

- `companies` → `roles` → `applications` (cascade delete)
- `resumes` — stored in `resumes` Supabase Storage bucket at `{user_id}/{timestamp}.pdf`
- `jd-files` — stored in `jd-files` Supabase Storage bucket at `{role_id}.pdf`
- `role_preferences` — learner "not interested" signals with reasons

Application status progression: `applied → shortlisted → hired` with two dropout statuses:
- `not_shortlisted` — company did not select for interview (pre-shortlist dropout)
- `rejected` — rejected after interview (post-shortlist dropout)

`applications` also stores `not_shortlisted_reason` and `rejection_feedback` (nullable TEXT). Admin sets these via a required modal when changing to those statuses; they are displayed to the learner on the role detail page.

Company display order is managed via `sort_order` column, with drag-to-reorder in `CompaniesListClient.tsx` (dnd-kit).

### Navigation

`components/NavLinks.tsx` — `ADMIN_LINKS` array drives the sidebar. SVGs are inline HeroIcons outline style.

Active nav state: `bg-zinc-800 text-white` with a left green (`#5BAE5B`) bar indicator.

### Google Sheets Sync

`app/api/sync/route.ts` (POST, admin-only) reads a Google Sheet via service account, upserts learners into Supabase, and deletes rows no longer present in the sheet. LF name-to-user_id mapping is resolved at sync time.

### Sheet Sync (table → Google Sheet) — `lib/sheetSync.ts`

The **reverse** direction: push an in-app table OUT to a Google Sheet where the **table is the source of truth**, while preserving columns the team maintains manually in that sheet. Reusable anywhere via `syncTableToSheet({ spreadsheetId, sheetName, rows, keyHeader, key, columns })`.

**How it behaves (important — read before relying on it):**
- Rows are matched between table and sheet by a **key column** (`keyHeader` + `key`).
- For a matched row it writes **only the managed cells** (the `columns` you declare), one cell at a time — never the whole row. So unmanaged columns (Notes, Owner, etc.) are left exactly as the team left them.
- A table row with **no matching key is appended**; its unmanaged columns are left blank.
- **Deletes are intentionally NOT propagated.** A row deleted from the source table is **left untouched in the sheet** (it goes stale, it is not removed or cleared). This is by design — silently deleting/blanking a row would destroy the manual columns on it. The sheet can therefore drift; if you need deletions *reflected*, add a managed status column and set it to `removed` for orphans (mark, don't delete). Hard deletes are deliberately unsupported.
- If a managed column's header is missing, it's appended to the header automatically. An empty tab is initialised with the header + all rows.

The pure diff lives in `computeSheetSync` (unit-tested in `__tests__/lib/sheetSync.test.ts`); the I/O wrapper uses the read+write `spreadsheets` scope (the read sync's scope is read-only). **Prerequisite: the target sheet must be shared with `GOOGLE_SERVICE_ACCOUNT_EMAIL` as Editor.**

Productised UI: `components/SyncToSheetButton.tsx` (reusable button + modal) takes a per-table sync server action as a prop. First use is the Admissions **Website hits** tab → `syncWebsiteHitsToSheet` in `app/(protected)/admissions/actions.ts` (source of truth `learner_applications`, matched by application `id`).

### Email campaigns (mail-merge) — `lib/email.ts` + `lib/emailTemplate.ts`

Generic templated email send. `lib/emailTemplate.ts` (pure, unit-tested) does `<<placeholder>>` substitution per row; `lib/email.ts` sends via the **Gmail API** (`lib/googleMail.ts`, REST over fetch — no SDK) using **one shared Google account** connected via OAuth. `sendTemplatedEmails` dedupes + validates recipients, then sends **one Gmail message per recipient** (Gmail has no batch endpoint). Reusable UI: `components/email/EmailCampaignButton.tsx` (compose subject/body with `<<field>>` chips, preview, **send-test-to-self**, then a two-step **confirm + send to N**). Each surface passes its rows + a server action; wired on **all three admissions tables** (Prospects, Website hits, Challenge → Review) → `sendEmailCampaign` in `app/(protected)/admissions/actions.ts` (admin-only, logs every recipient to `email_log`, migration 058). The button lives in the DataTable toolbar and targets the **selected rows** (via DataTable row selection) or, if none selected, the **currently-filtered rows**.

**Google OAuth email setup:** the sending account is connected under **Settings → Email** (`/api/google/connect` → `/api/google/callback`); the refresh token is stored in `email_oauth_credentials` (migration 062, one row, `provider` unique). `getGmailSender()` mints a fresh access token per send. Needs `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` (separate from the Sheets/BigQuery service account) with `gmail.send` + `userinfo.email` scopes and redirect URI `<origin>/api/google/callback`. The From address is always the connected account (Gmail can't spoof); `EMAIL_FROM_NAME` sets only the display name.

Sends are **admin-only** and **inert until a Google account is connected** (returns a clear "connect a Google account under Settings → Email" error). Gmail caps sending (~2,000 recipients/day on Workspace) — split very large campaigns across days. **Not yet built (do before any large/marketing send):** unsubscribe link + suppression/opt-out list. HTML bodies are plain-text for now.

### Alumni Data Ownership — Important

Two separate data sources feed the `alumni` table. Do NOT mix them up:

- **Historical cohorts (pre-2025-26)** — managed entirely via the alumni sheet sync (`/api/sync-alumni`). Company/role/salary all come from the Google Sheet. Re-syncing the sheet is safe; it only touches rows present in the sheet.
- **Current cohort (2025-26 onwards)** — alumni rows are auto-created by the learner sync (step 6) for learners with status "Placed - HVA" or "Placed - Self". Company/role/salary are populated automatically when an admin marks an application as `hired` in the Placements UI (see `updateApplicationStatus` in `actions.ts`). **Do not add these learners to the alumni sheet** — their data lives in Pulse.

The alumni sheet sync will never overwrite Pulse-managed rows because those learners are not in the sheet. The learner sync uses `ignoreDuplicates: true` so it won't overwrite existing alumni rows either.

**Cohort analytics live computation:** Only the cohort defined by `LIVE_COHORT` in `app/(protected)/alumni/page.tsx` is auto-computed from the learners table. All other cohorts use manually entered `cohort_stats`. When a new cohort goes live, update `LIVE_COHORT` in that file.

### sensai (BigQuery) — secondary data source

**sensai** is HyperVerge's internal learning management platform. It's a multi-tenant system: each `organization` defines `courses` and `cohorts`; courses are matched to cohorts (many-to-many); each cohort contains many `users` (learners); each course has many `tasks`, grouped into `milestones`. Learners progress through tasks, and each task completion has a score.

**Pulse uses sensai as a secondary metric data source alongside Google Sheets.** Where Sheets gives admins ad-hoc per-metric uploads, sensai gives us authoritative course-engagement and assessment data straight from the LMS.

**Connection details:**
- GCP project (data): `sensai-441917`
- Dataset: `sensai_prod` (17 base tables + 6 external + 53 curated views)
- GCP project (billing — where jobs.insert runs): `hyperverge-chabtbot`
- Service account: `pulse-sync@hv-contribution.iam.gserviceaccount.com` — needs `BigQuery Job User` on `hyperverge-chabtbot` and `BigQuery Data Viewer` on `sensai-441917`
- Auth wired through `lib/bigquery.ts` (`runBigQuery(billingProject, sql)`); credentials reuse `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`
- One-off exploration script: `scripts/bq-explore.ts` — edit the `QUERY` constant and run `npx tsx scripts/bq-explore.ts`

**HVA-specific scoping:**
- HVA org ID = **4** (organizations.name = `HyperVerge Academy`). NOT 270 — that org exists but is empty in BigQuery. Verified via course count: org 4 has 74 course rows; orgs 270, 268, 3, 13, 65, etc. all have 0. Note that the `courses` table has duplicate rows (likely upsert mirroring without dedup) — always `SELECT DISTINCT` or `GROUP BY id` when listing courses.
- Pulse learners ↔ sensai users join key: **email** (high confidence — verified clean on both sides; lowercase + trim before joining to be safe)
- The Pulse-side filter for "active learners" is `learners.is_current_cohort = true` (see Known Issues for caveats)
- The list of HVA courses we care about is **fixed but externally managed** — ask the user when implementing a new metric; don't assume

**Task completion semantics (still being explored):**
- 3 states: `unattempted`, `attempted`, `completed`
- Re-attempt and scoring logic TBD — needs verification against `task_completions` schema before building anything that aggregates them

**Time grain for metrics:** weekly is the default unless stated otherwise.

**Curated views vs base tables:** there are 53 views (incl. `coding_assessment_data`, `weekly_coding_task`, `orbit_*_active_days`, `learner_assessment_data`, etc.) maintained by the sensai data team. They're convenient and embed standard joins/scoping, but verify the SQL behind any view before relying on it for a Pulse metric — definitions can drift.

#### Explanation of sensai data model

**Hierarchy:** organizations → courses + cohorts → users (learners) and tasks. A course is matched to one or more cohorts. A cohort has many learners (`user_cohorts`). A course has many tasks grouped into milestones (`course_tasks` + `course_milestones`).

**Tasks come in 3 types:**
1. **Reading material** — passive content. Ignore for engagement metrics.
2. **Quiz / question** — the most interesting type for Pulse metrics. Each quiz contains multiple questions.
3. **Assignment** — long-form submissions. Ignore for now.

**Questions inside a quiz can be:**
- **Objective** — graded right/wrong (binary correct flag).
- **Subjective** — graded against a **scorecard** with multiple parameters; sensai assigns a numeric score per parameter (so a single subjective question yields a vector of parameter scores, not a single number). The aggregate score per question/task is then derived from those parameter scores.

**Task progression states (derived, not stored as a flag):**
- `unattempted` — no `task_completions` row exists for the (user, task) pair
- `attempted` — at least one question in the task has been touched, but not all are completed
- `completed` — all questions in the task have been completed
- These rules need to be confirmed empirically against `task_completions` and `questions` — don't assume.

**`task_completions` schema is sparse:** `(id, user_id, task_id, question_id, created_at)` only. No score column, no state column. Score lives in `scorecards` / `question_scorecards`. State has to be derived from join cardinality (e.g., count of distinct questions completed vs total questions in the task).

**Key tables for Pulse-relevant queries:**
- `users` — join key is `email` (lowercased). `users.id` is what other tables FK to.
- `user_cohorts` — many-to-many; `role` distinguishes learners from mentors.
- `cohorts.org_id = 270` for HVA.
- `courses.org_id = 270` for HVA.
- `course_tasks` — task ↔ course mapping (use this to filter task completions to a specific course).
- `tasks.type` — filter to quiz/question types only.
- `task_completions` — the per-event log `(user_id, task_id, question_id, created_at)`; **no score column**.
- `questions`, `scorecards`, `question_scorecards` — scoring metadata, but actual numeric scores are NOT stored here.

**Where scores actually live — the recipe:**
Scores are inside `chat_history.content` as JSON, written by sensai's AI grader. The pattern (lifted directly from the `learner_assessment_data` view):

```sql
-- Per (user, question), get the latest grader response
WITH assistant_evals AS (
  SELECT
    ch.user_id,
    ch.question_id,
    SAFE_CAST(
      COALESCE(
        JSON_EXTRACT_SCALAR(ch.content, '$.score'),
        JSON_EXTRACT_SCALAR(JSON_EXTRACT_ARRAY(ch.content, '$.scorecard')[SAFE_OFFSET(0)], '$.score')
      ) AS FLOAT64
    ) AS score,
    SAFE_CAST(
      COALESCE(
        JSON_EXTRACT_SCALAR(ch.content, '$.pass_score'),
        JSON_EXTRACT_SCALAR(JSON_EXTRACT_ARRAY(ch.content, '$.scorecard')[SAFE_OFFSET(0)], '$.pass_score')
      ) AS FLOAT64
    ) AS pass_score,
    SAFE_CAST(JSON_EXTRACT_SCALAR(ch.content, '$.is_correct') AS BOOL) AS is_correct,
    ch.created_at
  FROM `sensai-441917.sensai_prod.chat_history` ch
  WHERE ch.role = 'assistant'
)
```

JSON keys to remember:
- `$.score` — numeric score for subjective (or top-level for either)
- `$.pass_score` — passing threshold (so pass = score >= pass_score)
- `$.scorecard[0].score` / `$.scorecard[0].pass_score` — fallback paths when wrapped in array
- `$.is_correct` — boolean for objective questions

Subjective questions yield a score per parameter via `scorecards` / `question_scorecards`, but the AI grader's final aggregated score is what ends up in `chat_history.content`. To get per-parameter scores you'd parse the full `scorecard` JSON array.

**Useful pre-built views to study before writing new queries:**
- `learner_assessment_data` — hardcoded to `course_id=431` (LSRW), pivots scores per assessment version. Good template for the score-extraction pattern but not directly reusable for other courses.
- `all_courses_data` — master view joining courses → milestones → tasks → questions; the right starting point for course filtering.
- `retool_course_data` — denormalized course/task/question metadata for Retool dashboards.
- `retool_chat_history_for_hva_fellows` — chat history pre-filtered to HVA users; convenient if HVA-only is what we want.
- `coding_assessment_data`, `web_development_assessment_data` — likely follow the same pattern as `learner_assessment_data` but for other course IDs.

**Caveat on views:** they're convenient but often hardcode `course_id` or assume specific milestone naming. Always read the SQL definition (`SELECT view_definition FROM INFORMATION_SCHEMA.VIEWS WHERE table_name = '...'`) before relying on one for a new metric.

**Data quality note — duplicate rows:** several base tables (`courses`, `chat_history`, possibly others) have duplicate rows with the same primary key. Likely caused by upsert mirroring without dedup. Always `SELECT DISTINCT` or `GROUP BY id` (with `ANY_VALUE()` for non-key columns) when listing or aggregating from these tables. Don't assume PK uniqueness.

**Score JSON shape inside `chat_history.content`** (verified empirically against a coding question, 2026):
```json
{
  "feedback": "Great work Aasma! ...",
  "scorecard": [
    {
      "category": "Score",
      "feedback": { "correct": "...", "wrong": null },
      "score": 4,
      "max_score": 4,
      "pass_score": 4
    }
  ]
}
```
Notes:
- `scorecard` is always an **array of categories**. For coding questions there's exactly one category called `"Score"`. For LSRW questions there are 4 (Reading/Writing/Listening/Speaking). Never assume a fixed shape.
- Some content may have a top-level `$.score` instead of nested under `scorecard[0]`. Always `COALESCE($.score, $.scorecard[0].score)`.
- **`max_score` is per-question and varies** (4 for coding, 8 for LSRW IELTS scale, etc.). Don't assume 0–100. To compare across questions use `score / max_score`.
- **"Passed" = `score >= pass_score`**. There is no boolean `passed` field.
- For objective questions, expect a top-level `$.is_correct` boolean instead of (or in addition to) a scorecard.
- `task_id` is **NULL on chat_history rows** — only `question_id` is set. Always join `chat_history.question_id → questions.task_id` to get the task.

**Pulse-specific decisions about how we surface sensai data:**

These are locked-in choices — refer here instead of asking the user again:

1. **Granularity of the per-task-score view:** stored at the **per-question-per-attempt** level. One row per `(learner_email, question_id, chat_history_event_at)`. We do NOT pre-aggregate to task or week — Pulse's metric layer does that downstream. Per-scorecard-category breakdown is only meaningful for multi-category questions (LSRW), so we collapse to the question level and keep the raw scorecard JSON in a column for future drill-down.
2. **All attempts kept** — never just the latest. Re-attempts are a useful signal. Aggregations downstream can `MAX(attempt_at)` if they only want the latest.
3. **Task completion semantics:** a task is "completed" when **every question in it has been passed** (`score >= pass_score`). "Attempted" = at least one question has been answered (regardless of pass). "Unattempted" = no chat_history rows for any question in the task.
4. **Selected courses (initial set):** course IDs `301` (Coding in Python), `319` (Web Development), `480` (React), `481` (Backend). All four are coding-track courses. The list can grow — store it as a constant in code so it's easy to extend.
5. **Time grain:** week (Monday-start). All time aggregations should bucket by `DATE_TRUNC(attempt_at, WEEK(MONDAY))`.

**Pulse ↔ BigQuery integration architecture:**

Pulse must stay fast — pages cannot query BigQuery on render. The data flow:

1. **BigQuery views are the heavy lifting layer.** They handle: joins, dedup, score JSON parsing, course/org/quiz-type filtering. Defined as `CREATE OR REPLACE VIEW` statements in `migrations/bq/*.sql`, version-controlled in this repo. The views live in the `sensai_prod` dataset alongside the existing 53 views.
   - **Application is manual** — the `pulse-sync@hv-contribution.iam.gserviceaccount.com` service account intentionally does NOT have BQ Data Editor on `sensai_prod`. To apply or update a view, copy the SQL from the migration file into the BigQuery console and run it as the sensai team owner.
   - **Verification is automated:** `npx tsx scripts/bq-verify.ts` runs a `SELECT COUNT(*)` against each expected view (read-only) and reports OK/MISSING. Run this after every manual apply.
2. **Pulse syncs from BQ to its own Postgres.** A scheduled or manual sync action runs `SELECT * FROM <view>` against BigQuery, paginates results, and bulk-inserts them into `metric_raw_rows` in Pulse Postgres. Same shape as the existing sheet sync.
3. **Pulse pages always read from `metric_raw_rows`** (Postgres). Never from BigQuery directly. This keeps page render fast and BQ costs predictable.
4. **Metric source type generalises to `bigquery`** (not `sensai`-specific). The `metric_sources` table grows a `source_type` column (`'sheet'` or `'bigquery'`) plus connection fields. The existing `metric_source_columns` mapping (learner_id / value / dimension) stays the same — admins can compose metrics on top of BQ-sourced data the same way they do for sheet-sourced data.
5. **Three BigQuery views** exist in `sensai_prod`, defined in `migrations/bq/`. Their relationship:

   **`001_pulse_task_question_attempts`** — the most granular view. One row per (learner, question, attempt). Contains: email, week, course, milestone, task, question, score, max_score, pass_score, is_correct, passed. Keeps all re-attempts (a learner answering the same question twice = two rows). **Not synced into Pulse** — exists purely for ad-hoc debugging in the BQ console (e.g., "why does this learner's score look wrong?").

   **`002_pulse_task_completion_status`** — rolls up from question level to task level. One row per (learner, task). Contains: total_questions in the task, how many this learner attempted, how many passed, and a derived `state` ('attempted' if some questions touched, 'completed' if all passed). **Not synced into Pulse** — useful for ad-hoc investigation of task-level progress.

   **`003_pulse_weekly_completion`** — the **only view Pulse actually syncs from**. Rolls up to (learner, week, course, milestone). Contains: tasks_attempted, tasks_completed, questions_attempted, questions_passed. This is the view that the `metric_sources` row of type `bigquery` points to, and what `syncDataSource` pulls into `metric_raw_rows`. Designed to be small (~5-10k rows) so syncs are fast and Supabase storage stays lean.

   The hierarchy: 001 → 002 → 003. Each is a progressively coarser aggregation. 001 and 002 are reference/debug tools; 003 is the operational data feed.

   All three filter to `org_id = 4` (all HVA courses) — **no hardcoded course list**. Course filtering happens downstream in Pulse's metric definition layer via dimension filters (e.g., "course_name = Coding in Python"). Adding a new course in sensai makes it automatically available in Pulse after the next sync.

### Challenge Review (challenge → interview selection gate)

The **Review** sub-tab in Admissions → Challenge (`components/admissions/ChallengeReviewTable.tsx`, in `ChallengeClient`; the views are **Review · Day-by-day · Detailed · By question** — the old **Pace** tab was retired and its unique columns folded into Review: a **Completed** items column, an **Activity** sparkline (each member's own first→last window), and per-date **heat columns** (shown by default; use the `compact` column meta for tight padding). `DataTable` also supports `initialColumnVisibility` for default-hiding columns elsewhere) is where the team decides who advances from the 14-day challenge to the interview. Two-stage model:

1. **System decision** — a pure, deterministic rule engine (`lib/challengeReview.ts`, `evaluateCandidate`) scores each candidate's signals against editable thresholds and yields **`selected` / `rejected` / `review`** (three states) plus per-criterion pass/fail. Recomputed live on every render from `metric_raw_rows` (never persisted for its own sake). **Precedence:** any hard **fail** → `rejected`; else any **`undetermined`** gate (na *because the candidate's own data is missing on an ACTIVE gate*) → **`review`** (don't auto-select — a human resolves the blank); else all pass → `selected`. A **not-yet-configured** gate is `na` but NOT `undetermined` (stays neutral) — so unconfigured thresholds don't flag everyone. `review` is NOT a confirmable verdict: `bulkConfirmChallengeDecisions` skips review rows (they need a manual decision in the drawer); `final_decision` stays `selected|rejected` only. Criteria carry a `group`:
   - **Engagement** (all real, from the synced view — attempted/passed **questions** come from the view's per-task `attempted_questions`/`passed_questions` columns): **% of quiz questions attempted ≥ N%** (`min_questions_attempted_pct`, editable), active-days > N, span ≥ N, cramming < N%. Key-question-score is a placeholder. The challenge tab shows a composition line (days · tasks = reading + quizzes · questions · total **items**, where items = reading tasks + questions) so the X/Y denominators are explicit.
   - **Eligibility** — straight-elimination / basic-fit gates from the SensAI **intake questions**, split into **Need** (**college** — fail if the candidate's college matches the editable `excluded_colleges` list, `na` when the list is empty; **per-capita income** = annual family income ÷ total family size, passes when *below* the editable `max_per_capita_income_annual` config threshold — `na` until set; **SES** — a weighted socio-economic need score, `lib/ses.ts`: each intake answer maps to a fixed 0–4 option score × the question's **editable weight**, summed; higher = more need; passes when ≥ the editable `ses_cutoff` (`na` until set). Rubric (options+scores) is fixed in code; weights + cutoff are edited in the Edit-rules **SES tab**. "Prefer not to say" scores as **1** (lowest need) on every question that offers it (gender, marital, social category, family situation) — `PNS_SCORE` in `lib/ses.ts`. Rubric includes **gender** (Q34016, Female=3/Male=2/Transgender=4/PNS=1); **family size** and **"place you come from"** are NOT in SES (family size feeds the per-capita criterion; place is covered by home location)) and **Work & Availability** (**graduation** — distance/online learners pass at any completion year; full-time/part-time students must finish by `GRAD_LATEST_YEAR` (2028), else fail; not-studying passes; late finisher with unknown course type → `na`. **work commitment** — not working ⇒ pass; working & earning over `max_work_income_annual` (editable, 6 LPA default) ⇒ fail *even if willing to quit*; working, at/below that, willing ⇒ pass, unwilling ⇒ fail). Per-capita denominator is family size (no "earning members" question exists). **consistency** — gap days (`span − active days`) must be `< max_gap_days` (editable, default 4 → at most 3 idle days; coupled with active-days/span). Missing candidate data on an active gate → `undetermined` → the candidate is flagged **`review`** (never auto-eliminated); a gate that isn't configured yet stays neutral. **Rules are individually toggleable**: `disabled_rules` (config, edited via the "Active rules" checkboxes in Edit-rules) lists criterion keys switched OFF — a disabled rule is still shown (greyed/struck) but does NOT gate the decision. `GATING_RULES` in `lib/challengeReview.ts` is the canonical toggleable list.
   - Sensitive fails (SES, college, per-capita income) are marked `internalOnly` so their feedback shows to the team but is withheld from the candidate.

   **Eligibility data pipeline (live for 4 of the gates):** the intake answers come from SensAI challenge questions, pulled via BigQuery view `migrations/bq/005_pulse_challenge_intake.sql` (one row per member with the *raw* latest answer per mapped question — course 587 IDs are hardcoded; a new challenge needs its own mapping). Synced into `metric_raw_rows` as a **"Challenge Intake"** `metric_sources` row (`bq_table = pulse_challenge_intake`). The page finds that source, and `lib/challengeIntake.ts` (pure, unit-tested) parses the messy raw answers → signals: **currently-studying** (Q34069), **graduation year** (Q34074), **course type** (Q34075: FT/PT/Distance/Online), **working** (from work-domain Q34084), **willing-to-quit** (Q34086), **own monthly salary** (Q34085), **family income** (Q34168) + **family size** (Q34160). Unparseable answers ⇒ signal undefined ⇒ criterion `na`, never an auto-eliminate. **College** (Q34073) is matched against the editable `excluded_colleges` list via `isExcludedCollege` — **fuzzy, not exact**: normalised (lowercase, all non-alphanumerics stripped so `R.V.`=`RV`) equality/substring either way, plus token-Jaccard ≥ 0.7 (word reordering / extra words). Deliberately NOT character-similarity (Dice/Levenshtein) — college names share boilerplate ("College of Engineering") that makes different colleges score falsely high; and NOT an LLM (this runs per-candidate on render — wrong tool). Manual steps when adding intake columns to view 005: re-apply the BQ view (sensai owner), then re-sync + set the new answer columns to role `dimension` (default `ignored` → empty), learner_id = email, in Settings → Data Sources; verify with `npx tsx scripts/bq-verify.ts`. Set thresholds via the Review tab's **Edit rules** modal. Migrations `059`–`064`, `066` (SES), `070` (`max_gap_days` + `disabled_rules`).
2. **Team verification** — a human confirms in the drawer (`ChallengeReviewDrawer.tsx`) or bulk-confirms the system verdict. The verdict is stored in `challenge_decisions.final_decision`. Overriding the system requires a written reason. `criteria_snapshot` + `system_decision_at_verify` are captured at decision time so (a) rejection feedback is stable and (b) the table flags `systemChanged` when the live system call later diverges from the human verdict (the human decision stands — a flag, not a reopen).
3. **Release** — recording a decision is **internal only**; the candidate portal shows nothing until it's explicitly *released* (`releaseChallengeDecisions` stamps `challenge_decisions.published_at`; bulk "Release to candidates" button + per-candidate toggle in the drawer). **The candidate portal reads `final_decision` only when `published_at` is set** — this replaced the old safety-lock as the deliberate candidate-facing gate. Release is reversible (Unrelease clears `published_at`). **Undo** (`clearChallengeDecisions`) deletes the decision row → back to Pending (also un-releases): bulk "Reset to pending" button + "Undo → Pending" in the drawer.

`REVIEW_DECISIONS_ENABLED` in `lib/challengeReview.ts` is `true` — recording decisions is safe now that **Release** (not recording) is the candidate-facing gate. Editable config lives in `challenge_review_config` (per `(cohort_id, course_id)`): numeric thresholds, `max_per_capita_income_annual`, and the `excluded_colleges` text[] — all via the "Edit rules" modal. Server actions in `app/(protected)/admissions/challenge/actions.ts`: `setChallengeDecision`, `bulkConfirmChallengeDecisions` (agree-with-system only), `releaseChallengeDecisions` (publish/unpublish to portal), `updateChallengeReviewConfig` — all `requireStaff`-gated. Migrations `059_challenge_review.sql`, `060`/`063` (per-capita + `published_at` + `excluded_colleges`).

**Candidate side:** `/candidate/selection` renders three states from `final_decision` (pending "under review" / selected "through to interview, wait" / rejected with **codified feedback** = the failed criteria's `failFeedback` strings from the snapshot). Portal-only, no email. The `/candidate/welcome` stepper advances the "Current" pill on decision (selected → Interview, rejected → Selection). The interview flow itself is a separate build.

### Job Outreach Engine

`app/(protected)/placements/` includes a Job Outreach tab backed by:

- DB: `migrations/003_job_outreach.sql` — `job_personas` and `job_opportunities` tables
- Scraper: `lib/scraper.ts` (Jooble API) + API endpoint at `app/api/scrape/route.ts`
- Requires `JOOBLE_API_KEY` env var

### Admissions Interviews (scheduling)

The interview flow for challenge-cleared candidates (fills the `/candidate/interview` stub). **Phase A (built): the scheduling machine.** Two **sequential** rounds per candidate (round 2 unlocks only after round 1 is `completed`); booking an interviewer's own published slot **auto-confirms** (no confirm step). Identity is the normalised email throughout.

- **Everything interview-related lives under Admissions → Interviews** (two sub-tabs, `components/admissions/InterviewsSubNav`): **Overview** (`page.tsx` — stats, add/manage interviewers, all bookings; `requireStaff`) and **My calendar** (`calendar/page.tsx` — the personal scheduling grid; `requireInterviewer`). There is NO top-level Interviews sidebar item and no separate `/interviewer` portal (retired).
- **Interviewers are Pulse users with role `interviewer`** (migration 069 adds it to `users_role_check`) — for people who ONLY interview. **Admin + staff also get interviewer privileges automatically** (`requireInterviewer` allows admin/staff/interviewer) and reach the same calendar via the sub-tab. A **dedicated `interviewer`** logs in and is scoped to ONLY `/admissions/interviews/calendar` with minimal chrome (no sidebar/other tabs): the `(protected)/layout.tsx` reads the path from an `x-pathname` header (set in `middleware.ts`) and redirects any other route back to the calendar, rendering `InterviewerHeader` instead of `AppShell`; the Admissions layout renders bare children for the interviewer role.
- **Data:** `interview_slots` (availability pool, `open→booked→blocked`) + `interviews` (`candidate_email, round, slot_id, interviewer_email, scheduled_at, status booked→confirmed→completed/no_show/cancelled, meet_link, calendar_event_id`), migration 069. Unique partial index = one non-cancelled interview per (candidate, round). RLS staff-only; candidate + interviewer reads go via the service-role client filtered to the authed email (candidates aren't in `users`).
- **Availability = "paint your week" grid** (`calendar/AvailabilityCalendar.tsx`): a 24×7, 30-min-cell week calendar, drag to add/remove availability, **fixed 30-min slots** (one cell = one bookable slot), "copy week → next", rolling 2 weeks, IST; booked interviews render locked (blue) on the grid + a list below with Done/No-show. `syncWeekAvailability(weekStart, starts[])` reconciles that week's OPEN slots to the painted set (creates missing, deletes removed-open, never touches booked/past). Candidate booking (`app/candidate/interview/`) unchanged — gated on `selected`+`published_at`, books the next round, round-2 pool excludes the round-1 interviewer, atomic `open→booked` claim then insert (rolls slot back on failure).
- Pure logic (`nextBookableRound`, `isSlotBookable`, `computeInterviewMetrics`, `validateNewSlot`, `overlaps`) in `lib/interviews.ts` (unit-tested).
- **Booking emails:** `lib/interviewInvite.ts` sends a plain confirmation to both parties via the existing shared Gmail account (no extra scope). **Calendar invite + Google Meet link is NOT built yet** — needs the shared Google account re-consented with a `calendar` scope (add to `GMAIL_SCOPES` + connect flow, enable Calendar API), then create events with `conferenceData`/`conferenceDataVersion=1`. **Phase B** (interview cockpit: dossier + question bank + notes + rubric scoring) and **Phase C** (AI second-opinion + live weak-answer flag) are not built. See the `interview-flow-design` memory for the full plan.

### SensAI grading evals (grader accuracy)

Human labels on the SensAI **AI grader's** output, so the team can measure grader accuracy + failure modes from the tab they already use. Exposed inline in **Admissions → Challenge → by-question** (`ChallengeQuestionsView` → select a question → every learner's answer + AI score/feedback; also in the per-learner `ConversationThreadModal`). For each (learner, question) the team tags **correct / incorrect**, and when incorrect picks one or more **symptoms** (deliberately symptoms, NOT root cause — diagnosis of scorecard-gap vs prompt-issue happens downstream): *inaccurate score · vague/unhelpful feedback · gives away the answer* (`EVAL_SYMPTOMS` in `lib/evals.ts`). Single-rater, **per-attempt** (one label per `(context, question_id, learner_email, attempt_at)`, upserted — every grader response is independently taggable, in both the cross-learner list and the conversation modal); a **snapshot** of the judged AI score + feedback + scorecard is captured at tag time so the label survives the grader re-running.

Program-agnostic by design — keyed by a `context` string (`EVAL_CONTEXT_SCREENING = 'screening'` now; other programs pass their own later). Store: `sensai_grading_evals` (migrations 067 + 068 for the per-attempt key, Pulse Postgres). Pure aggregation (`computeEvalStats`, `statsByQuestion`, `validateEvalInput`) in `lib/evals.ts` (unit-tested); server actions (`setGradingEval`, `getGradingEval`, `getQuestionEvals`, `getGradingEvals`, `requireStaff`-gated) in `app/(protected)/admissions/challenge/evals.ts`; reusable UI `components/evals/EvalTagger.tsx`. Per-question accuracy + symptom tally show in the by-question header. **Reusable base layer** — drop `<EvalTagger>` into any view that shows grader output; slice reporting by `context`.

### Team Tools — Scorecard Studio

`app/(protected)/tools/` (sidebar **Tools**, staff+admin only — `requireStaff`; hidden for guests) is a home for team utilities. First tool: **Scorecard Studio**, three functions for SensAI grading rubrics ("scorecards"):
- **Generate** — question + grading intent (+ optional example answers as anchors) → a scorecard built on six principles (observable descriptors, explicit fail condition, one-thing-per-scorecard, anchored levels, question-specific, few levels).
- **Inspect** — scores a pasted scorecard 0–100 on AI-gradeability across the six dimensions, flags vague spots (verbatim snippet + fix), and can **Rewrite it tighter**.
- **Test** — dry-runs grading an answer against a scorecard **three times** and shows the score/feedback + whether it's consistent.

Prompts + pure helpers (`parseModelJSON`, `normalizeInspect`) live in `lib/tools/scorecard.ts` (unit-tested); the Anthropic calls + validation/auth are server actions in `app/(protected)/tools/actions.ts` (model `claude-sonnet-4-6`, needs `ANTHROPIC_API_KEY`). UI is `ScorecardStudio.tsx` (Pulse design language). **The Test tab's grading system prompt (`TEST_SYSTEM`) is a PLACEHOLDER approximation of SensAI's grader, flagged `TEST_PROMPT_IS_PLACEHOLDER` — swap in the real SensAI grading prompt when available so it mirrors production.** Adding a new protected route means updating both `protectedPrefixes` and `matcher` in `middleware.ts` (done for `/tools`).

### UI Conventions

**Before making any UI changes, read `docs/ui-design-language.md`.** It is the single source of truth for colours, typography, spacing, borders, cards, tables, buttons, tabs, modals, badges, and empty states.

- Tailwind CSS utility classes throughout; custom green `#5BAE5B` for active nav states
- Tab navs: `border-b` container, active tab indicator = `h-0.5 bg-[#5BAE5B]` absolutely positioned at bottom
- Client components that need optimistic updates use `useTransition` with server actions
- Modals are rendered inline via the `Modal.tsx` component (fixed backdrop + centered panel), not a portal
- **Data tables: use the shared `components/ui/DataTable.tsx` for EVERY new table — this is the standard, do not hand-roll a new TanStack table.** Pass `data`, `columns` (TanStack `ColumnDef[]`), and a `storageKey`; it provides sticky header, sorting, per-column filters (search-within + faceted counts), a column show/hide menu, persisted sizing + visibility, CSV export, search box, row count, "Clear filters", and `toolbarLeft/right` slots. Key props: `pinnedLeft` (pinned on desktop, **auto-unpinned on mobile** so frozen columns don't break narrow screens), `searchKeys`, `csvFilename`, `getRowId`, `rowClassName`, `enableRowSelection` (adds a checkbox column). `toolbarLeft`/`toolbarRight` accept either a node or a render function `({ selectedRows, filteredRows, clearSelection }) => node` — that's how a toolbar action (e.g. the email button) targets the picked rows, falling back to the filtered rows when nothing is selected. A column opts out of filtering with `enableColumnFilter: false` (do this for date columns) and out of hiding with `enableHiding: false` (do this for action/link columns); array-valued columns supply their filter options via `meta.facetOptions` and a custom `filterFn`. Reference implementations: `app/(protected)/admissions/{learner-applications,prospects}` tables. Pure filter helpers live in `lib/tableFilters.ts`.
- **PENDING — migrate existing tables to `DataTable`** (not yet done; preserve each one's special behavior — modals, toolbars, row-click, inline edit): `users/UsersTable`, `placements/{RolesTable (entangled with CompaniesListClient's shared toolbar + ref), ApplicationsList (row-select + bulk status), NotInterestedTable (array reason filter), MatchingTable (col-order, status dropdown, popups)}`, `learners/LearnersTable` (FY + View-All), `alumni/AlumniTable` (inline edit), `learning/{CasesTable, ClosedCasesTable}`, `outreach/OpportunitiesClient` (row→drawer), `admissions/ChallengeMatrixTable` (heatmap). The two plain-`<table>` screens (`learning/attendance`, `learning/action-center`) are out of scope unless converted deliberately.
- **Placement pipeline** status badges: blue=applied/reviewed, amber=shortlisted/in-process, emerald=hired/open, red=rejected, zinc=closed/not-shortlisted/not-interested (placement-specific; see `docs/ui-design-language.md` for learning health data colours)

## Database Schema

Full schema dump is at `docs/schema.sql`. Always refer to this for column names and types — do not infer from migration files, which are incomplete.

**When adding a new query, always ask: does this column need an index?** Indexes to consider whenever you add a `.eq()`, `.in()`, or `.filter()` on a column that isn't already indexed:
- Any foreign key column used in joins or filters (e.g. `user_id`, `role_id`, `learner_id`)
- Any column used as a filter in a list/analytics page (e.g. `lf_name`, `batch_name`, `status`, `preference`)

Existing indexes are in `migrations/007_performance_indexes.sql` and `migrations/020_missing_indexes.sql`. Add new ones in a new migration file.

**`docs/schema.sql` must ALWAYS be kept in sync — this is a hard rule.** Any time you add or change a migration, regenerate the dump and commit it in the same PR as the migration. Never leave the dump stale. Regenerate it only *after* the migration has actually been applied to the linked database (a dump reflects the live DB, not the migration files), so the sequence is: write migration → apply it → regenerate dump → commit both together. If you cannot apply the migration yourself (no DB access), say so explicitly and flag that the dump regen is still owed.

```bash
supabase db dump --linked --schema public -f docs/schema.sql
```

**To check if the current dump is up-to-date** (empty diff = current, any output = stale):

```bash
supabase db dump --linked --schema public | diff docs/schema.sql -
```

## Known Issues

- Pre-existing TS error in `.next/types/validator.ts` about `(learner)/learner/my-roles/page.js` — not from our code, safe to ignore
- `npm run lint` broken locally (next lint path issue) — use `npx tsc --noEmit` for type checking instead
- **`is_current_cohort` needs proper logic.** The column on `learners` is meant to mark "part of the active programme" — `/dashboard` and `/learning` both filter by it. But the sync (`app/api/sync/route.ts:83`) hardcodes it to `true` for every row on every upsert, so manual edits to set it `false` get blown away on the next sync. Net effect today: every learner across every cohort year is treated as current. Carryover learners (joined in a previous FY but still active this year) work *only* by accident because of this. Long-term fix: add a `Carryover` column to the Learner Roster sheet and derive `is_current_cohort = (cohort_fy === current FY) || carryover === true` in the sync. Then `/learning` and `/dashboard` filters become meaningful.
- **~~Learners table "All Years" filter is undercounting.~~ FIXED.** Root cause was the `/learners` default cohort filter hardcoding `cohort_fy = '2025-26'` when no `fy` param was set (even though the dropdown showed "All Cohorts"), which dropped 2024-25 carryovers (e.g. Vinita Gupta). Now `lib/learnersCohortFilter.ts` maps the default / "All Cohorts" / `fy=all` to `is_current_cohort = true`, and a specific year to `cohort_fy`. (The deeper `is_current_cohort` hardcode caveat above still stands — it currently marks every learner current — but the symptom is resolved.)
