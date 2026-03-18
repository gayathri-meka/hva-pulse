# Database Backup

Automated daily backups run via GitHub Actions (`.github/workflows/db-backup.yml`) at **2am UTC**.

Each backup includes:
- `pulse_YYYY-MM-DD.dump` — full Postgres dump in custom format (use `pg_restore` to restore)
- `pulse_YYYY-MM-DD.sql` — same dump as plain SQL (human-readable)
- `{table}_YYYY-MM-DD.csv` — one CSV per table (human-readable, opens in Google Sheets)

Backups are kept as GitHub Actions artifacts for **30 days**.

---

## 1. Required GitHub Secret

| Secret name | Value | Where to find it |
|---|---|---|
| `SUPABASE_DB_URL` | Full Postgres connection string | Supabase dashboard → **Project Settings** → **Database** → **Connection string** → **URI** tab. Use the **Session pooler** URL (port 5432, not 6543) for reliability. |

Add it at: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

The connection string looks like:
```
postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

---

## 2. Optional: Google Drive upload

If you want backups uploaded to Google Drive in addition to the artifact, set two more secrets:

| Secret name | Value |
|---|---|
| `BACKUP_GDRIVE_FOLDER_ID` | The folder ID from the Google Drive URL: `drive.google.com/drive/folders/FOLDER-ID-HERE` |
| `GDRIVE_SERVICE_ACCOUNT_JSON` | The full JSON key file content of a Google Cloud service account with Drive access |

### Setting up the service account

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Enable APIs** → enable **Google Drive API**
2. **IAM & Admin** → **Service Accounts** → **Create service account** (name it e.g. `pulse-backup`)
3. On the service account, **Keys** → **Add key** → **Create new key** → JSON → download the file
4. Paste the entire JSON file contents as the `GDRIVE_SERVICE_ACCOUNT_JSON` secret
5. In Google Drive, right-click the target folder → **Share** → add the service account email (ends in `@...iam.gserviceaccount.com`) with **Editor** permission

If `BACKUP_GDRIVE_FOLDER_ID` is not set, the Drive upload step is skipped automatically.

---

## 3. Manual trigger

Go to **GitHub repo → Actions → Database Backup → Run workflow** to trigger a backup outside the scheduled time.

---

## 4. Restore from backup

### Restore the custom-format dump to a local Postgres database

```bash
# Create a target database
createdb pulse_restore

# Restore (prompts for password if needed)
pg_restore \
  --dbname=pulse_restore \
  --schema=public \
  --no-acl \
  --no-owner \
  --verbose \
  pulse_YYYY-MM-DD.dump
```

### Restore the plain SQL dump

```bash
psql pulse_restore < pulse_YYYY-MM-DD.sql
```

### Restore to a new Supabase project

1. Create a new Supabase project
2. Get its connection string from **Project Settings → Database → Connection string → URI**
3. Run:

```bash
pg_restore \
  --dbname="postgresql://postgres.NEW-PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres" \
  --schema=public \
  --no-acl \
  --no-owner \
  pulse_YYYY-MM-DD.dump
```

> **Note:** Row Level Security policies are included in the dump. If restoring to a fresh Supabase project, re-apply any custom RLS policies or migrations that aren't captured in the dump.

---

## 5. Downloading an artifact

1. GitHub repo → **Actions** → click the backup run
2. Scroll to **Artifacts** at the bottom
3. Click **db-backup-XXXXXX** to download a zip of all backup files
