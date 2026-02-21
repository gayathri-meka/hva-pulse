# HVA Pulse

Internal operating system for HVA — used by staff to track learners, manage Learning Facilitators, and oversee program outcomes.

## What it does

Pulse is an admin-facing web app that gives HVA's team a single place to:

- **Track learners** — name, batch, status (Ongoing / Placed / Dropout / Discontinued), LF assignment, track, and join date
- **Manage users** — add admins and LFs, update roles, maintain LF display names
- **Sync from Google Sheets** — one-click pull from the master sheet into Supabase (admin only)
- **LF dashboards** — Learning Facilitators see only their assigned learners

## Roles

| Role | Access |
|---|---|
| **Admin** | Full access: all learners, user management, Google Sheets sync |
| **LF** | Dashboard showing assigned learners; can browse all but cannot manage users |

Access is controlled via the `users` table in Supabase. Only users added there (with a matching Google account) can sign in.

## Stack

- **Framework** — Next.js (App Router)
- **Database & Auth** — Supabase (Postgres + Google OAuth)
- **Data sync** — Google Sheets API via a service account
- **Styling** — Tailwind CSS

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/gayathri-meka/hva-pulse.git
cd hva-pulse
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with a Google account that has been added to the `users` table in Supabase.

## Database tables

| Table | Columns |
|---|---|
| `users` | `email`, `role` (`admin` \| `lf`) |
| `lfs` | `id`, `name`, `email` |
| `learners` | `learner_id`, `name`, `email`, `phone_number`, `category`, `lf_id`, `lf_name`, `status`, `batch_name`, `tech_mentor_name`, `core_skills_mentor_name`, `track`, `join_date` |

## Adding a user

1. Go to **Users** in the sidebar (admin only)
2. Enter their Google account email and assign a role
3. For LF users, enter their display name — this maps them to the `lfs` table and links their learners
4. They can sign in immediately via Google OAuth
