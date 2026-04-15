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
    .from('learners')
    .select('sub_cohort, status')

  const combos = new Map<string, number>()
  for (const l of data ?? []) {
    const key = (l.sub_cohort ?? 'null') + ' | ' + (l.status ?? 'null')
    combos.set(key, (combos.get(key) ?? 0) + 1)
  }

  console.log('sub_cohort | status → count:')
  for (const [k, v] of [...combos.entries()].sort()) {
    console.log('  ' + k + ' → ' + v)
  }
}

main().catch(console.error)
