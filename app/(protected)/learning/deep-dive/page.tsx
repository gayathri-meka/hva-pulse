import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser, canSeePII } from '@/lib/auth'
import { maskName, maskEmail } from '@/lib/pii'
import LearnerSearchBox from '@/components/learning/LearnerSearchBox'
import LearnerAnalysisView from '@/components/learning/LearnerAnalysisView'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ learner?: string }>
}

export default async function DeepDivePage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const { learner: selectedLearnerId } = await searchParams
  const supabase = await createServerSupabaseClient()
  const showPII = canSeePII(appUser.role)

  // Fetch all learners for the search box
  const { data: allLearners } = await supabase
    .from('learners')
    .select('learner_id, users!learners_user_id_fkey(name, email)')
    .eq('is_current_cohort', true)
    .order('lf_name')

  const learnerOptions = (allLearners ?? []).map((l) => {
    const u = l.users as unknown as { name: string; email: string } | null
    return { learner_id: l.learner_id, name: showPII ? (u?.name ?? l.learner_id) : maskName(u?.name, l.learner_id), email: showPII ? (u?.email ?? '') : maskEmail(u?.email) }
  })

  // Fetch selected learner's analysis
  let analysis: { raw_data: unknown; analysis_text: string | null; computed_at: string } | null = null
  let learnerInfo: { name: string; email: string; batch_name: string | null; lf_name: string | null; status: string | null } | null = null

  if (selectedLearnerId) {
    const [{ data: analysisRow }, { data: learnerRow }] = await Promise.all([
      supabase
        .from('learner_analysis')
        .select('raw_data, analysis_text, computed_at')
        .eq('learner_id', selectedLearnerId)
        .maybeSingle(),
      supabase
        .from('learners')
        .select('learner_id, lf_name, batch_name, status, users!learners_user_id_fkey(name, email)')
        .eq('learner_id', selectedLearnerId)
        .single(),
    ])

    if (analysisRow) {
      analysis = {
        raw_data:      analysisRow.raw_data,
        analysis_text: analysisRow.analysis_text,
        computed_at:   analysisRow.computed_at,
      }
    }

    if (learnerRow) {
      const u = learnerRow.users as unknown as { name: string; email: string } | null
      learnerInfo = {
        name:       showPII ? (u?.name ?? selectedLearnerId) : maskName(u?.name, selectedLearnerId),
        email:      showPII ? (u?.email ?? '') : maskEmail(u?.email),
        batch_name: learnerRow.batch_name ?? null,
        lf_name:    learnerRow.lf_name ?? null,
        status:     (learnerRow as unknown as { status: string }).status ?? null,
      }
    }
  }

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Learning</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-zinc-200">
        {[
          { key: 'all',           label: 'Dashboard',     href: '/learning?filter=all' },
          { key: 'interventions', label: 'Interventions', href: '/learning?filter=interventions' },
          { key: 'deep-dive',     label: 'Deep Dive',     href: '/learning/deep-dive' },
          ...(appUser.role !== 'learner' ? [{ key: 'settings', label: 'Settings', href: '/learning/settings' }] : []),
        ].map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            className={`relative pb-3 px-1 mr-4 text-sm font-medium transition-colors ${
              key === 'deep-dive' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
            {key === 'deep-dive' && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
          </Link>
        ))}
      </div>

      {/* Learner search */}
      <div className="mb-6">
        <LearnerSearchBox
          learners={learnerOptions}
          selectedId={selectedLearnerId ?? null}
          baseUrl="/learning/deep-dive"
        />
      </div>

      {/* Analysis */}
      {selectedLearnerId && learnerInfo && analysis && (
        <LearnerAnalysisView
          learner={learnerInfo}
          analysisText={analysis.analysis_text}
          rawData={analysis.raw_data}
          computedAt={analysis.computed_at}
        />
      )}

      {selectedLearnerId && learnerInfo && !analysis && (
        <div className="rounded-xl border border-zinc-200 px-8 py-12 text-center">
          <p className="text-sm text-zinc-400">No analysis data available for this learner yet.</p>
          <p className="mt-1 text-xs text-zinc-300">Run the analysis pipeline to generate insights.</p>
        </div>
      )}

      {!selectedLearnerId && (
        <p className="text-sm text-zinc-400">Select a learner to view their learning analysis.</p>
      )}
    </div>
  )
}
