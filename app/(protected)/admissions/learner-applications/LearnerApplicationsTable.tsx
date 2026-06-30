'use client'

import { useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import type { LearnerApplication } from './page'
import ChallengeStatusBadge from '@/components/admissions/ChallengeStatusBadge'
import CommentsCell from '@/components/admissions/CommentsCell'
import { normEmail, type ProspectComment } from '@/lib/prospectComments'
import SyncToSheetButton from '@/components/SyncToSheetButton'
import type { SyncToSheetResult } from '@/lib/sheetSync'
import DataTable from '@/components/ui/DataTable'
import EmailCampaignButton, { type EmailCampaignAction } from '@/components/email/EmailCampaignButton'

const EMAIL_FIELDS = ['name', 'email', 'phone', 'college_name', 'educational_status', 'referral_source', 'challenge_status']

function formatStatus(value: string | null): string {
  if (!value) return '—'
  return value.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const col = createColumnHelper<LearnerApplication>()

export default function LearnerApplicationsTable({
  applications,
  commentsByEmail,
  currentUserId,
  isAdmin,
  syncAction,
  serviceAccountEmail,
  currentUserEmail,
  emailAction,
}: {
  applications: LearnerApplication[]
  commentsByEmail: Record<string, ProspectComment[]>
  currentUserId: string
  isAdmin: boolean
  syncAction: (sheetUrl: string, tab: string) => Promise<SyncToSheetResult>
  serviceAccountEmail: string
  currentUserEmail: string
  emailAction: EmailCampaignAction
}) {
  const [hideDuplicates, setHideDuplicates] = useState(true)

  // Dedupe by email (newest kept — applications arrive newest-first). Emailless
  // rows are always kept. This is a data-level toggle, not a column filter.
  const data = useMemo(() => {
    if (!hideDuplicates) return applications
    const seen = new Set<string>()
    return applications.filter((a) => {
      const key = a.email?.trim().toLowerCase()
      if (!key) return true
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [applications, hideDuplicates])

  const columns = useMemo(
    () => [
      col.accessor('created_at', {
        header: 'Submitted',
        size: 130,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-500">{formatDate(info.getValue())}</span>,
      }),
      col.accessor('name', {
        header: 'Name',
        size: 180,
        cell: (info) => <span className="font-medium text-zinc-900">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('email', {
        header: 'Email',
        size: 240,
        cell: (info) => {
          const v = info.getValue()
          return v
            ? <a href={`mailto:${v}`} className="text-zinc-600 hover:text-zinc-900 hover:underline">{v}</a>
            : <span className="text-zinc-400">—</span>
        },
      }),
      col.accessor('phone', {
        header: 'Phone',
        size: 130,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('college_name', {
        header: 'College',
        size: 240,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('educational_status', {
        header: 'Educational Status',
        size: 180,
        cell: (info) => (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
            {formatStatus(info.getValue())}
          </span>
        ),
      }),
      col.accessor('referral_source', {
        header: 'How did they hear?',
        size: 180,
        cell: (info) => {
          const v = info.getValue()
          return v ? (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
              {formatStatus(v)}
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )
        },
      }),
      col.accessor('referral_detail', {
        header: 'Referral detail',
        size: 220,
        cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
      }),
      col.accessor((a) => (a.signed_into_pulse ? 'Yes' : 'No'), {
        id: 'signed_into_pulse',
        header: 'Signed into Pulse?',
        size: 150,
        cell: (info) => {
          const method = info.row.original.match_method
          return info.row.original.signed_into_pulse ? (
            <span
              title={method === 'token' ? 'Matched by signup token' : 'Matched by email'}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Yes
              <span className="font-normal text-emerald-500/70">· {method}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              No
            </span>
          )
        },
      }),
      col.accessor('challenge_status', {
        header: 'Challenge',
        size: 140,
        cell: (info) => <ChallengeStatusBadge status={info.getValue()} />,
      }),
      col.display({
        id: 'comments',
        header: () => <>Comments</>,
        size: 120,
        cell: (info) => (
          <CommentsCell
            email={info.row.original.email}
            comments={commentsByEmail[normEmail(info.row.original.email)] ?? []}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        ),
      }),
    ],
    [commentsByEmail, currentUserId, isAdmin],
  )

  return (
    <DataTable
      data={data}
      columns={columns}
      storageKey="learner-admissions"
      getRowId={(r) => r.id}
      enableRowSelection={isAdmin}
      pinnedLeft={['created_at', 'name']}
      searchKeys={['name', 'email']}
      searchPlaceholder="Search name or email…"
      csvFilename="website_hits"
      emptyMessage="No applications yet."
      toolbarLeft={
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600">
          <input
            type="checkbox"
            checked={hideDuplicates}
            onChange={(e) => setHideDuplicates(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
          />
          Hide duplicates
        </label>
      }
      toolbarRight={({ selectedRows, filteredRows }) => (
        <>
          {isAdmin && (
            <EmailCampaignButton
              rows={(selectedRows.length ? selectedRows : filteredRows) as unknown as Record<string, unknown>[]}
              fields={EMAIL_FIELDS}
              defaultRecipientField="email"
              currentUserEmail={currentUserEmail}
              action={emailAction}
              campaign="website-hits"
              label="Email"
              title="Email website-hit applicants (mail-merge)"
            />
          )}
          <SyncToSheetButton
            action={syncAction}
            serviceAccountEmail={serviceAccountEmail}
            label="Sync to Sheets"
            title="Sync Website hits to Google Sheets"
          />
        </>
      )}
    />
  )
}
