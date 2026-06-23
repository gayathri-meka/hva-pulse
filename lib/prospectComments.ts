// Email-keyed comment threads shared by the Admissions "Website hits" and
// "Prospects" tabs. Comments are keyed by normalised email so the same person
// shows the same thread in both places.

export type ProspectComment = {
  id: string
  email: string
  body: string
  author_id: string | null
  author_name: string | null
  created_at: string
}

export const normEmail = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/** Group comment rows by normalised email, newest first within each thread. */
export function groupCommentsByEmail(rows: ProspectComment[]): Record<string, ProspectComment[]> {
  const map: Record<string, ProspectComment[]> = {}
  for (const r of rows) {
    const key = normEmail(r.email)
    if (!key) continue
    ;(map[key] ??= []).push(r)
  }
  for (const k in map) {
    map[k].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
  }
  return map
}
