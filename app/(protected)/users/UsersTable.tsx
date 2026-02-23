'use client'

import { useState, useTransition } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnSizingState,
} from '@tanstack/react-table'

const SIZING_KEY = 'hva-col-users'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}
import { updateUser } from './actions'

type User = { id: string; email: string; name: string | null; role: string; created_at: string }

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  LF:      'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  learner: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initials = (name ?? email)[0].toUpperCase()
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
      {initials}
    </div>
  )
}

const col = createColumnHelper<User>()

const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900'

export default function UsersTable({ users }: { users: User[] }) {
  const [sorting, setSorting]           = useState<SortingState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadSizing)
  const [editId, setEditId]       = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole]   = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function startEdit(user: User) {
    setEditId(user.id)
    setEditName(user.name ?? '')
    setEditEmail(user.email)
    setEditRole(user.role)
    setSaveError(null)
  }

  function cancelEdit() {
    setEditId(null)
    setSaveError(null)
  }

  function save() {
    if (!editId) return
    setSaveError(null)
    startTransition(async () => {
      const result = await updateUser(editId, { name: editName, email: editEmail, role: editRole })
      if (result.error) {
        setSaveError(result.error)
      } else {
        setEditId(null)
      }
    })
  }

  const columns = [
    col.accessor('name', {
      header: 'Name',
      size: 220,
      cell: (info) => {
        const user = info.row.original
        if (editId === user.id) {
          return (
            <div className="flex items-center gap-3">
              <Avatar name={editName || null} email={editEmail || user.email} />
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name"
                className={inputCls}
              />
            </div>
          )
        }
        return (
          <div className="flex items-center gap-3">
            <Avatar name={user.name} email={user.email} />
            <span className="truncate font-medium text-zinc-900">{user.name ?? '—'}</span>
          </div>
        )
      },
    }),
    col.accessor('email', {
      header: 'Email',
      size: 260,
      cell: (info) => {
        const user = info.row.original
        if (editId === user.id) {
          return (
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className={inputCls}
            />
          )
        }
        return <span className="truncate text-zinc-500">{user.email}</span>
      },
    }),
    col.accessor('role', {
      header: 'Role',
      size: 110,
      cell: (info) => {
        const user = info.row.original
        if (editId === user.id) {
          return (
            <div className="relative">
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full appearance-none rounded-md border border-zinc-200 bg-white py-1.5 pl-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <option value="admin">admin</option>
                <option value="LF">LF</option>
                <option value="learner">learner</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )
        }
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              ROLE_BADGE[user.role] ?? 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {user.role}
          </span>
        )
      },
    }),
    col.accessor('created_at', {
      header: 'Added',
      size: 120,
      cell: (info) => (
        <span className="text-zinc-400">
          {new Date(info.getValue()).toLocaleDateString('en-GB')}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      size: 100,
      enableSorting: false,
      enableResizing: false,
      header: () => null,
      cell: (info) => {
        const user = info.row.original
        if (editId === user.id) {
          return (
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={isPending}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="text-xs text-zinc-400 hover:text-zinc-700"
              >
                Cancel
              </button>
            </div>
          )
        }
        return (
          <button
            onClick={() => startEdit(user)}
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-900"
          >
            Edit
          </button>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: (updater) => {
      setColumnSizing((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        localStorage.setItem(SIZING_KEY, JSON.stringify(next))
        return next
      })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
  })

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-zinc-400">No users found.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {saveError && (
        <div className="border-b border-red-100 bg-red-50 px-6 py-2.5 text-sm text-red-600">
          {saveError}
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          className="border-collapse text-sm"
          style={{ width: '100%', minWidth: table.getCenterTotalSize() }}
        >
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
              {table.getFlatHeaders().map((header) => (
                <th
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="relative select-none px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                >
                  <div
                    className={header.column.getCanSort() ? 'flex cursor-pointer items-center gap-1' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                    {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                  </div>
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-zinc-300"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={editId === row.id ? 'bg-zinc-50' : 'hover:bg-zinc-50'}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className={editId === row.id ? 'px-6 py-3' : 'px-6 py-3.5'}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
