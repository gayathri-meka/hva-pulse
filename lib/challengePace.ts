// Pace metrics for the Challenge → Pace view. Derived per learner from their
// tasks-done-per-IST-calendar-day map (Member.activityByDate). All bucketing is
// done upstream in IST (see challenge/page.tsx).

export type PaceMetrics = {
  activeDays: number          // distinct calendar days with ≥1 task
  spanDays: number            // first→last activity, inclusive (0 if no activity)
  total: number               // total tasks done
  crammingPct: number         // busiest-day tasks ÷ total, 0–100 (high = crammed)
  firstDate: string | null
  lastDate: string | null
  // One entry per calendar day from first→last (gaps included as count 0).
  // `day` is the learner's own day index (1-based) — "their day 1, day 2, …".
  series: { day: number; date: string; count: number }[]
}

const EMPTY: PaceMetrics = {
  activeDays: 0, spanDays: 0, total: 0, crammingPct: 0,
  firstDate: null, lastDate: null, series: [],
}

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`)

export function paceMetrics(activityByDate: Record<string, number>): PaceMetrics {
  const dates = Object.keys(activityByDate).sort()
  if (dates.length === 0) return EMPTY

  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]
  const total = dates.reduce((s, d) => s + activityByDate[d], 0)
  const busiest = Math.max(...dates.map((d) => activityByDate[d]))

  const series: PaceMetrics['series'] = []
  let day = 1
  for (let t = dayMs(firstDate); t <= dayMs(lastDate); t += 86400000, day++) {
    const date = new Date(t).toISOString().slice(0, 10)
    series.push({ day, date, count: activityByDate[date] ?? 0 })
  }

  return {
    activeDays: dates.length,
    spanDays: series.length,
    total,
    crammingPct: total ? Math.round((busiest / total) * 100) : 0,
    firstDate,
    lastDate,
    series,
  }
}
