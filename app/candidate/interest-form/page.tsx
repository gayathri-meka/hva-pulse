import { IconInfoCircle } from '@tabler/icons-react'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { mapMarketingEducation, mapMarketingReferral } from '@/lib/marketingFields'
import InterestForm from './InterestForm'

export const dynamic = 'force-dynamic'

const EDUCATION_OPTIONS = [
  'Completed 12th',
  'Currently pursuing degree (graduating 2026)',
  'Currently pursuing degree (graduating 2027)',
  'Currently pursuing degree (graduating 2028 or later)',
  'Completed graduation',
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
    .select('name, phone, college, education_status, referral_source, referral_detail, interest_form_submitted_at, signup_token')
    .eq('email', email)
    .maybeSingle()

  // If this prospect came from the marketing apply form, pull their submission
  // so we can pre-fill the form. Token-first, email-fallback (same precedence
  // as the admissions matching). Only used until they submit the interest form
  // once — after that, their own saved values take over.
  let marketing:
    | {
        name: string | null
        phone: string | null
        college_name: string | null
        educational_status: string | null
        referral_source: string | null
        referral_detail: string | null
      }
    | null = null
  const mktCols = 'name, phone, college_name, educational_status, referral_source, referral_detail'
  if (prospect?.signup_token) {
    const { data } = await admin
      .from('learner_applications')
      .select(mktCols)
      .eq('signup_token', prospect.signup_token)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    marketing = data
  }
  if (!marketing) {
    const { data } = await admin
      .from('learner_applications')
      .select(mktCols)
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    marketing = data
  }

  const metadata = (user!.user_metadata ?? {}) as Record<string, unknown>
  const metadataName =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    ''

  const submitted = !!prospect?.interest_form_submitted_at

  // Pre-fill source: once submitted, trust the prospect's own saved values;
  // before that, prefer the marketing submission (what they typed on the apply
  // form), then the prospect/Google name.
  const fullName = (submitted ? prospect?.name : marketing?.name || prospect?.name) || metadataName
  const firstName = fullName?.trim().split(/\s+/)[0] || null
  const defaultPhone = (submitted ? prospect?.phone : prospect?.phone || marketing?.phone) ?? ''
  const defaultCollege =
    (submitted ? prospect?.college : prospect?.college || marketing?.college_name) ?? ''

  // Education: prospect stores the human label; the marketing form stores a
  // code, so map it. Then collapse to the dropdown shape (canonical vs Other).
  const mktEduLabel = mapMarketingEducation(marketing?.educational_status)
  const stored = (submitted ? prospect?.education_status : prospect?.education_status || mktEduLabel)?.trim() ?? ''
  const isCanonical = EDUCATION_OPTIONS.includes(stored)
  const defaultEducation = stored ? (isCanonical ? stored : 'Other') : ''
  // Only a genuine free-text answer fills the "Other" box — not the literal "Other".
  const defaultEducationOther = stored && !isCanonical && stored !== 'Other' ? stored : ''

  // Referral ("How did you hear about us?"). The marketing form uses the same
  // option labels, so we pass the stored value through directly — if it ever
  // diverges (e.g. coded values), the form's dropdown just falls back to empty.
  const defaultReferralSource =
    (submitted
      ? prospect?.referral_source
      : prospect?.referral_source || mapMarketingReferral(marketing?.referral_source)) || ''
  const defaultReferralDetail =
    (submitted ? prospect?.referral_detail : prospect?.referral_detail || marketing?.referral_detail) ?? ''

  return (
    <main className="pb-32 sm:pb-40">
      {/* HERO */}
      <section className="sm:text-center">
        <div className="mx-auto max-w-3xl px-5 pb-5 pt-7 sm:px-8 sm:pb-6 sm:pt-10">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-4 py-2 text-[15px] font-extrabold text-[#166534] sm:text-[16px]">
              <span aria-hidden>📝</span>
              Step 2 · Personal Information
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
          defaultReferralSource={defaultReferralSource}
          defaultReferralDetail={defaultReferralDetail}
          firstName={firstName}
          alreadySubmitted={!!prospect?.interest_form_submitted_at}
        />
      </div>
    </main>
  )
}
