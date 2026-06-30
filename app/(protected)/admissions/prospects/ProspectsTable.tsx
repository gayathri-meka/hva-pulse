'use client'

import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import type { Prospect } from './page'
import ChallengeStatusBadge from '@/components/admissions/ChallengeStatusBadge'
import CommentsCell from '@/components/admissions/CommentsCell'
import { normEmail, type ProspectComment } from '@/lib/prospectComments'
import DataTable from '@/components/ui/DataTable'
import EmailCampaignButton, { type EmailCampaignAction } from '@/components/email/EmailCampaignButton'

const EMAIL_FIELDS = ['name', 'email', 'phone', 'college', 'education_status', 'referral_source', 'challenge_status']

function formatLabel(value: string | null): string {
  if (!value) return '—'
  return value.includes('_')
    ? value.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
    : value
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const col = createColumnHelper<Prospect>()

export default function ProspectsTable({
  prospects,
  commentsByEmail,
  currentUserId,
  isAdmin,
  currentUserEmail,
  emailAction,
}: {
  prospects: Prospect[]
  commentsByEmail: Record<string, ProspectComment[]>
  currentUserId: string
  isAdmin: boolean
  currentUserEmail: string
  emailAction: EmailCampaignAction
}) {
  const columns = useMemo(
    () => [
      col.accessor('created_at', {
        header: 'Signed up',
        size: 140,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-500">{formatDate(info.getValue())}</span>,
      }),
      col.accessor('name', {
        header: 'Name',
        size: 200,
        cell: (info) => <span className="font-medium text-zinc-900">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('email', {
        header: 'Email',
        size: 260,
        cell: (info) => (
          <a href={`mailto:${info.getValue()}`} className="text-zinc-600 hover:text-zinc-900 hover:underline">
            {info.getValue()}
          </a>
        ),
      }),
      col.accessor('phone', {
        header: 'Phone',
        size: 130,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('college', {
        header: 'College',
        size: 240,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('education_status', {
        header: 'Education status',
        size: 220,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('referral_source', {
        header: 'How did they hear?',
        size: 180,
        cell: (info) => {
          const v = info.getValue()
          return v ? (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
              {formatLabel(v)}
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
      col.accessor((row) => (row.interest_form_submitted_at ? 'Submitted' : 'Pending'), {
        id: 'interest_form',
        header: 'Interest form',
        size: 150,
        cell: (info) =>
          info.getValue() === 'Submitted' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Submitted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              Pending
            </span>
          ),
      }),
      col.accessor('challenge_status', {
        header: 'Challenge',
        size: 140,
        cell: (info) => <ChallengeStatusBadge status={info.getValue()} />,
      }),
      col.accessor((row) => row.interest_form_submitted_at, {
        id: 'form_fill_date',
        header: 'Form fill date',
        size: 140,
        enableColumnFilter: false,
        sortingFn: (a, b) => {
          const av = a.original.interest_form_submitted_at
          const bv = b.original.interest_form_submitted_at
          if (!av && !bv) return 0
          if (!av) return 1
          if (!bv) return -1
          return new Date(av).getTime() - new Date(bv).getTime()
        },
        cell: (info) => {
          const v = info.getValue() as string | null
          return v ? <span className="text-zinc-500">{formatDate(v)}</span> : <span className="text-zinc-300">—</span>
        },
      }),
      col.accessor('last_seen_at', {
        header: 'Last seen',
        size: 140,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-500">{formatDate(info.getValue())}</span>,
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
      data={prospects}
      columns={columns}
      storageKey="prospects"
      getRowId={(r) => r.id}
      enableRowSelection={isAdmin}
      pinnedLeft={['created_at', 'name']}
      searchKeys={['name', 'email']}
      searchPlaceholder="Search name or email…"
      csvFilename="prospects"
      emptyMessage="No prospects yet."
      toolbarRight={
        isAdmin
          ? ({ selectedRows, filteredRows }) => (
              <EmailCampaignButton
                rows={(selectedRows.length ? selectedRows : filteredRows) as unknown as Record<string, unknown>[]}
                fields={EMAIL_FIELDS}
                defaultRecipientField="email"
                currentUserEmail={currentUserEmail}
                action={emailAction}
                campaign="prospects"
                label="Email"
                title="Email prospects (mail-merge)"
              />
            )
          : undefined
      }
    />
  )
}
