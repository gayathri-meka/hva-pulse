import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data } = await supabase.from('learner_analysis').select('email, raw_data')
  const durga = (data ?? []).find((d) => d.email.includes('durgesh'))
  if (!durga) { console.log('Not found'); return }

  const rd = durga.raw_data as any
  const sp = rd.score_progressions ?? []
  console.log('Total progressions:', sp.length)
  console.log('\nFirst 3 progressions:')
  for (const p of sp.slice(0, 3)) {
    console.log('  Keys:', Object.keys(p))
    console.log('  score_progression:', JSON.stringify(p.score_progression))
    console.log('  total_attempts:', p.total_attempts, typeof p.total_attempts)
    const parts = (p.score_progression ?? '').split(' -> ')
    console.log('  Split parts:', parts.length, parts)
    console.log()
  }

  // Count brute force manually
  let bf = 0
  for (const p of sp) {
    const parts = (p.score_progression ?? '').split(' -> ')
    if (parts.length < 4) continue
    const scores = parts.map((s: string) => {
      const [a, b] = s.split('/')
      return b ? parseFloat(a) / parseFloat(b) : 0
    })
    const early = scores.slice(0, -1)
    const last = scores[scores.length - 1]
    const avgEarly = early.reduce((a: number, b: number) => a + b, 0) / early.length
    if (avgEarly < 0.5 && last >= 0.9 && early.length >= 3) {
      bf++
      if (bf <= 3) console.log('  BF match:', p.score_progression)
    }
  }
  console.log('Brute-force count:', bf)
}
main().catch(console.error)
