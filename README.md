# HVA Pulse

Pulse is HyperVerge Academy's internal operating system — one place for the team to run **admissions**, track learners through the **programme**, support their **learning**, and manage **placements** and **alumni outcomes**.

## What's inside

- **Admissions** — the candidate journey from interest form → 14-day challenge → a review gate that decides who advances to interview. The review engine scores candidates on financial need, availability, and challenge engagement.
- **Learners** — the roster: identity, cohort, status, and LF/mentor assignment (synced from Google Sheets).
- **Learning** — learner-health monitoring: attendance, assessments, and case management (flag → intervene → monitor → resolve), backed by Google Sheets and the sensai LMS (via BigQuery).
- **Placements** — companies, roles, and the application pipeline, plus a learner-facing surface for browsing roles and a job-outreach scraper.
- **Alumni** — placed-learner outcomes (company, role, salary) and cohort analytics.
- **Ask Pulse** — natural-language questions answered over Pulse's own data.
- **Settings** — users & roles, Google Sheet / BigQuery data sources, and exports.

## Who uses it

| Surface | Who | What they see |
|---|---|---|
| **Main app** | Staff & Admins | Dashboard, learners, admissions, learning, placements, alumni. Admins additionally manage users, data sources, and destructive actions. |
| **Learner portal** | Learners | A focused placements surface — roles, profile, résumé. |
| **Candidate flow** | Applicants | Public onboarding — interest form, challenge, and selection status. |

Access is controlled by the `users` table plus Google OAuth — only added accounts can sign in.

## Tech

- **Next.js** (App Router) · **Supabase** (Postgres + Google OAuth) · **Tailwind CSS**
- Data in from **Google Sheets** (service account) and **sensai / BigQuery**
- Email via **Resend** · deployed on **Vercel**

## Getting started

```bash
git clone https://github.com/gayathri-meka/hva-pulse.git
cd hva-pulse
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a Google account listed in the `users` table.

## Learn more

[`CLAUDE.md`](./CLAUDE.md) is the detailed reference — architecture, module deep-dives, data model, conventions, and the full environment-variable list.
