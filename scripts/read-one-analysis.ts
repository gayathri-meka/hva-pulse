import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const name = process.argv[2] || 'durgashankar'
  const { data } = await supabase.from('learner_analysis').select('email, analysis_text')
  const match = (data ?? []).find((d) => d.email.toLowerCase().includes(name.toLowerCase()) || d.analysis_text?.toLowerCase().includes(name.toLowerCase()))
  if (!match) { console.log('Not found: ' + name); return }
  console.log('Email: ' + match.email)
  console.log()
  console.log(match.analysis_text)
}
main().catch(console.error)
