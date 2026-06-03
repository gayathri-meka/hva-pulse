import { IconInfoCircle } from '@tabler/icons-react'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import InterestForm from './InterestForm'

export const dynamic = 'force-dynamic'

const EDUCATION_OPTIONS = [
  'Completed 12th, not in college right now',
  'In college, graduating in 2026',
  'In college, graduating in 2027',
  'In college, graduating after 2027',
  'Graduated and working',
  'Graduated, not working',
]

export default async function InterestFormPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user!.email!.toLowerCase()

  // prospects RLS only allows admin/staff to read, so use the service-role
  // client to fetch this prospect's own row (filtered by their authed email).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: prospect } = await admin
    .from('prospects')
    .select('name, phone, college, education_status, interest_form_submitted_at')
    .eq('email', email)
    .maybeSingle()

  const metadata = (user!.user_metadata ?? {}) as Record<string, unknown>
  const metadataName =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    ''

  const fullName = prospect?.name || metadataName
  const firstName = fullName?.trim().split(/\s+/)[0] || null

  // Map stored education_status back to the dropdown shape: if it matches a
  // canonical option, use it directly; otherwise treat it as an "Other" answer
  // and pre-fill the free-text input with the stored value.
  const stored = prospect?.education_status?.trim() ?? ''
  const isCanonical = EDUCATION_OPTIONS.includes(stored)
  const defaultEducation = stored ? (isCanonical ? stored : 'Other') : ''
  const defaultEducationOther = stored && !isCanonical ? stored : ''

  return (
    <main className="pb-32 sm:pb-40">
      {/* HERO */}
      <section className="sm:text-center">
        <div className="mx-auto max-w-3xl px-5 pb-5 pt-7 sm:px-8 sm:pb-6 sm:pt-10">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-4 py-2 text-[15px] font-extrabold text-[#166534] sm:text-[16px]">
              <span aria-hidden>📝</span>
              Step 2 · Interest Form
            </span>
          </div>
          <h1
            className="text-[22px] font-black text-zinc-900"
            style={{
              fontFamily: 'var(--font-jakarta), sans-serif',
              lineHeight: 1.25,
            }}
          >
            Tell us about yourself
          </h1>
        </div>
      </section>

      {/* BODY */}
      <div className="mx-auto max-w-3xl space-y-3 px-4 pt-3 sm:space-y-4 sm:px-6 sm:pt-4">
        {/* Explanation card — shown above both the form view and the summary view */}
        <div className="rounded-2xl border-[0.5px] border-[#fde68a] bg-[#fffbeb] p-3.5 sm:p-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-[#92400e] sm:text-[13px]">
            <IconInfoCircle size={16} stroke={2} />
            What this form is and why we ask
          </div>
          <p className="text-[13px] leading-[1.55] text-[#78350f] sm:text-[14px]">
            Submitting this form is how you tell us you&apos;d like to join HVA. Your
            details help us check basic eligibility, match you with the right mentor,
            and stay in touch about the next steps. All your data stays private with us.
          </p>
        </div>

        <InterestForm
          defaultName={fullName ?? ''}
          defaultEmail={email}
          defaultPhone={prospect?.phone ?? ''}
          defaultCollege={prospect?.college ?? ''}
          defaultEducation={defaultEducation}
          defaultEducationOther={defaultEducationOther}
          firstName={firstName}
          alreadySubmitted={!!prospect?.interest_form_submitted_at}
        />
      </div>
    </main>
  )
}
