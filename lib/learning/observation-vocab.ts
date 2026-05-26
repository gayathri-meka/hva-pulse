// Vocabulary for the structured observation fields. Type / Severity /
// Accountable Team are fixed enums; Category is admin-editable in
// /learning/settings/configurations (settings key: 'observation_categories').

export const OBSERVATION_TYPES = ['Positive', 'Neutral', 'Concern'] as const
export type ObservationType = typeof OBSERVATION_TYPES[number]

export const OBSERVATION_SEVERITIES = ['Low', 'Medium', 'High'] as const
export type ObservationSeverity = typeof OBSERVATION_SEVERITIES[number]

export const OBSERVATION_TEAMS = ['Program', 'Learning'] as const
export type ObservationTeam = typeof OBSERVATION_TEAMS[number]

export const DEFAULT_OBSERVATION_CATEGORIES = [
  'Engagement',
  'Communication',
  'Comprehension',
  'Integrity',
]

export const OBSERVATION_TYPE_BADGE: Record<ObservationType, string> = {
  Positive: 'bg-emerald-100 text-emerald-700',
  Neutral:  'bg-zinc-100 text-zinc-600',
  Concern:  'bg-amber-100 text-amber-700',
}

export const OBSERVATION_SEVERITY_BADGE: Record<ObservationSeverity, string> = {
  Low:    'bg-zinc-100 text-zinc-600',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-red-100 text-red-700',
}
