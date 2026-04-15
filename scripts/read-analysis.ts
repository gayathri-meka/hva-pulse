import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data } = await supabase
    .from('learner_analysis')
    .select('learner_id, email, raw_data')
    .limit(1)
    .single()

  if (!data) { console.log('No data'); return }

  const rd = data.raw_data as any
  console.log('Learner:', data.email)
  console.log('Course summary rows:', rd.course_summary?.length ?? 0)
  console.log('Weakest areas:', rd.weakest_areas?.length ?? 0)
  console.log('Score progressions:', rd.score_progressions?.length ?? 0)
  console.log('Feedback samples:', rd.feedback_samples?.length ?? 0)
  console.log('Activity timeline:', rd.activity_timeline?.length ?? 0)
  console.log()
  console.log('=== Course Summary ===')
  for (const c of (rd.course_summary ?? []).slice(0, 10)) {
    console.log(c.course_name + ' | ' + c.question_type + ' | pass_rate: ' + c.first_attempt_pass_rate + '% | avg_score: ' + c.avg_first_score + '% | retries: ' + c.retries)
  }
  console.log()
  console.log('=== Top 5 Weakest Areas ===')
  for (const w of (rd.weakest_areas ?? []).slice(0, 5)) {
    console.log(w.course_name + ' | ' + w.milestone_name + ' | first_pass: ' + w.first_pass_rate + '% (' + w.questions + ' qs)')
  }
  console.log()
  console.log('=== Top 5 Retried Questions ===')
  const sorted = (rd.score_progressions ?? []).sort((a: any, b: any) => (b.total_attempts ?? 0) - (a.total_attempts ?? 0))
  for (const p of sorted.slice(0, 5)) {
    console.log(p.course_name + ' | ' + p.question_title + ' | ' + p.score_progression + ' (' + p.total_attempts + ' attempts)')
  }
}

main().catch(console.error)
