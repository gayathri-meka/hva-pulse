// Pure, server-safe definition of the top-level Learning tabs. Lives outside
// the 'use client' component file so server components can call it too.

export type LearningTab = {
  key:   string
  label: string
  href:  string
}

// Single source of truth for the top-level Learning tab strip. All four
// /learning/* pages call this — adding a new tab in one place updates them
// all instead of going stale (which is how Attendance went missing on the
// Settings and Deep Dive pages previously).
export function topLevelLearningTabs({
  role,
  lf,
}: {
  role?: 'admin' | 'staff' | 'guest' | 'learner'
  lf?:   string | null
} = {}): LearningTab[] {
  const qs = lf ? `&lf=${encodeURIComponent(lf)}` : ''
  return [
    { key: 'action-center', label: 'Action Center', href: '/learning/action-center' },
    { key: 'attendance',    label: 'Attendance',    href: '/learning/attendance' },
    { key: 'all',           label: 'Completion',    href: `/learning?filter=all${qs}` },
    { key: 'cases',         label: 'Cases',         href: `/learning?filter=cases${qs}` },
    { key: 'deep-dive',     label: 'Deep Dive',     href: '/learning/deep-dive' },
    // Learners never see Settings; admins/staff/guests do.
    ...(role !== 'learner'
      ? [{ key: 'settings', label: 'Settings', href: '/learning/settings' }]
      : []),
  ]
}
