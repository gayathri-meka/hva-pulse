'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconPencil,
} from '@tabler/icons-react'
import CollegeAutocomplete from './CollegeAutocomplete'
import { submitInterestForm } from './actions'

// Must match the marketing apply form (academy.hyperverge.org/apply/learner) exactly.
const EDUCATION_OPTIONS = [
  'Completed 12th',
  'Currently pursuing degree (graduating 2026)',
  'Currently pursuing degree (graduating 2027)',
  'Currently pursuing degree (graduating 2028 or later)',
  'Completed graduation',
  'Other',
]

// "How did you hear about us?" — mirrors the apply form. Each source reveals a
// detail field except "college" (already captured by College Name). Social
// media uses a fixed platform list; everything else is free text.
type ReferralDetailKind = 'none' | 'text' | 'platforms'
const REFERRAL_OPTIONS: { value: string; detail: ReferralDetailKind; detailLabel?: string }[] = [
  { value: 'Through an NGO',                       detail: 'text',      detailLabel: 'Which NGO?' },
  { value: 'Referred by a friend or peer',         detail: 'text',      detailLabel: 'Who referred you?' },
  { value: 'Referred by an HVA alumni',            detail: 'text',      detailLabel: 'Which alumni referred you?' },
  { value: 'Through my college or university',     detail: 'none' },
  { value: 'Through social media',                 detail: 'platforms', detailLabel: 'Which platform?' },
  { value: 'Found it myself (Google / other search)', detail: 'none' },
  { value: 'Other',                                detail: 'text',      detailLabel: 'Please specify' },
]

const SOCIAL_PLATFORMS = ['LinkedIn', 'Website', 'Instagram', 'Facebook', 'WhatsApp']

const referralDetailKind = (source: string): ReferralDetailKind =>
  REFERRAL_OPTIONS.find((o) => o.value === source)?.detail ?? 'none'

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'college' | 'education' | 'referral', string>>

type EditableField = 'name' | 'phone' | 'college' | 'education' | 'referral'
type FieldSnapshot = {
  name: string
  phone: string
  college: string
  education: string
  educationOther: string
  referralSource: string
  referralDetail: string
}

export default function InterestForm({
  defaultName,
  defaultEmail,
  defaultPhone,
  defaultCollege,
  defaultEducation,
  defaultEducationOther,
  defaultReferralSource,
  defaultReferralDetail,
  firstName,
  alreadySubmitted,
}: {
  defaultName: string
  defaultEmail: string
  defaultPhone: string
  defaultCollege: string
  defaultEducation: string
  defaultEducationOther: string
  defaultReferralSource: string
  defaultReferralDetail: string
  firstName: string | null
  alreadySubmitted: boolean
}) {
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState(defaultPhone)
  const [email, setEmail] = useState(defaultEmail)
  const [college, setCollege] = useState(defaultCollege)
  const [education, setEducation] = useState(defaultEducation)
  const [educationOther, setEducationOther] = useState(defaultEducationOther)
  const [referralSource, setReferralSource] = useState(defaultReferralSource)
  const [referralDetail, setReferralDetail] = useState(defaultReferralDetail)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(alreadySubmitted)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Inline per-field edit state (used inside the summary view)
  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [savingField, setSavingField]   = useState(false)
  const [fieldError, setFieldError]     = useState<string | null>(null)
  const [editingSnapshot, setEditingSnapshot] = useState<FieldSnapshot | null>(null)

  // Switching the referral source clears any stale detail (e.g. a platform
  // value left over from a previous choice).
  function changeReferralSource(value: string) {
    setReferralSource(value)
    setReferralDetail('')
  }

  function startEdit(field: EditableField) {
    setEditingField(field)
    setFieldError(null)
    setEditingSnapshot({ name, phone, college, education, educationOther, referralSource, referralDetail })
  }

  function cancelEdit() {
    if (editingSnapshot) {
      setName(editingSnapshot.name)
      setPhone(editingSnapshot.phone)
      setCollege(editingSnapshot.college)
      setEducation(editingSnapshot.education)
      setEducationOther(editingSnapshot.educationOther)
      setReferralSource(editingSnapshot.referralSource)
      setReferralDetail(editingSnapshot.referralDetail)
    }
    setEditingField(null)
    setEditingSnapshot(null)
    setFieldError(null)
  }

  async function resubmitField() {
    if (!editingField) return
    setFieldError(null)
    const allErrors = validate()
    const err = allErrors[editingField as keyof Errors]
    if (err) {
      setFieldError(err)
      return
    }
    setSavingField(true)
    const result = await submitInterestForm(buildPayload())
    setSavingField(false)
    if (result.ok) {
      setEditingField(null)
      setEditingSnapshot(null)
    } else {
      setFieldError(result.error)
    }
  }

  // Builds the server payload from current state (shared by full submit and
  // per-field resubmit). Detail is cleared for sources that don't take one.
  function buildPayload() {
    const kind = referralDetailKind(referralSource)
    return {
      name: name.trim(),
      phone: phone.trim(),
      college: college.trim(),
      education_status: education === 'Other' ? educationOther.trim() : education,
      referral_source: referralSource,
      referral_detail: kind === 'none' ? '' : referralDetail.trim(),
    }
  }

  function validate(): Errors {
    const e: Errors = {}
    if (!name.trim()) e.name = 'Please enter your name'
    if (!/^\d{10}$/.test(phone)) e.phone = 'Enter a 10-digit number'
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Enter a valid email'
    if (!college.trim()) e.college = 'Please enter your college name'
    if (!education) e.education = 'Pick one'
    else if (education === 'Other' && !educationOther.trim()) e.education = 'Please tell us briefly'
    if (!referralSource) e.referral = 'Pick one'
    else {
      const kind = referralDetailKind(referralSource)
      if (kind !== 'none' && !referralDetail.trim()) e.referral = 'Please add a bit more'
    }
    return e
  }

  const errors = validate()
  const isValid = Object.keys(errors).length === 0

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ name: true, phone: true, email: true, college: true, education: true, referral: true })
    if (!isValid) return
    setSubmitError(null)
    startTransition(async () => {
      const result = await submitInterestForm(buildPayload())
      if (result.ok) {
        setSubmitted(true)
      } else {
        setSubmitError(result.error)
      }
    })
  }

  if (submitted) {
    const educationDisplay =
      education === 'Other' ? educationOther : education
    const referralDisplay =
      referralSource && referralDetailKind(referralSource) !== 'none' && referralDetail
        ? `${referralSource} — ${referralDetail}`
        : referralSource
    const anyEditing = editingField !== null
    const editControls = {
      editingField,
      savingField,
      fieldError,
      anyEditing,
      onEdit: startEdit,
      onCancel: cancelEdit,
      onResubmit: resubmitField,
    }

    return (
      <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-6 sm:p-8">
        {/* Banner */}
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-[#dcfce7] px-3.5 py-3">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#16a34a]">
            <IconCheck size={12} stroke={3} className="text-white" />
          </span>
          <div>
            <div className="text-[13px] font-extrabold text-[#166534] sm:text-[14px]">
              {firstName ? `Thanks, ${firstName}!` : 'Thanks!'} Your interest form is submitted.
            </div>
            <div className="mt-0.5 text-[12px] text-[#166534]/80 sm:text-[13px]">
              Here&apos;s what you shared. Tap edit on any item to update it.
            </div>
          </div>
        </div>

        {/* Summary list with inline editing */}
        <div className="mb-5 space-y-2">
          <EditableRow field="name" label="Name" value={name} {...editControls}>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={EDIT_INPUT_CLASS}
              placeholder="Full name"
            />
          </EditableRow>

          <EditableRow field="phone" label="WhatsApp number" value={phone} {...editControls}>
            <input
              autoFocus
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className={EDIT_INPUT_CLASS}
              placeholder="9876543210"
            />
          </EditableRow>

          <SummaryRow label="Email" value={email} />

          <EditableRow field="education" label="Education status" value={educationDisplay} {...editControls}>
            <div className="relative">
              <select
                autoFocus
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className={`${EDIT_INPUT_CLASS} appearance-none pr-10 ${education ? 'text-zinc-900' : 'text-zinc-400'}`}
              >
                <option value="" disabled>Choose a status</option>
                {EDUCATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="text-zinc-900">{opt}</option>
                ))}
              </select>
              <IconChevronDown
                size={18}
                stroke={2}
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
            </div>
            {education === 'Other' && (
              <input
                type="text"
                value={educationOther}
                onChange={(e) => setEducationOther(e.target.value)}
                placeholder="Tell us briefly"
                className={`mt-2 ${EDIT_INPUT_CLASS}`}
              />
            )}
          </EditableRow>

          <EditableRow field="college" label="College" value={college} {...editControls}>
            <CollegeAutocomplete
              id="college-edit"
              value={college}
              onChange={setCollege}
              placeholder="Start typing your college name…"
            />
          </EditableRow>

          <EditableRow field="referral" label="How you heard about us" value={referralDisplay} {...editControls}>
            <ReferralFields
              id="referral-edit"
              source={referralSource}
              detail={referralDetail}
              onSource={changeReferralSource}
              onDetail={setReferralDetail}
              variant="edit"
            />
          </EditableRow>
        </div>

        {/* CTA */}
        <Link
          href="/candidate/challenge"
          className={`group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1f0f] px-6 py-4 text-[15px] font-extrabold text-white shadow-sm transition-all sm:text-[16px] ${
            anyEditing ? 'pointer-events-none opacity-50' : 'hover:bg-[#15301a] hover:shadow-md active:scale-[0.99]'
          }`}
        >
          Start the 14-day Challenge
          <IconArrowRight
            size={16}
            stroke={2.5}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-[18px] sm:p-6"
    >
      <Field
        id="name"
        label="Your name"
        value={name}
        onChange={setName}
        onBlur={() => markTouched('name')}
        error={touched.name ? errors.name : undefined}
        placeholder="Full name"
        required
      />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Field
          id="phone"
          label="WhatsApp number"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={phone}
          onChange={(v) => setPhone(v.replace(/\D/g, ''))}
          onBlur={() => markTouched('phone')}
          error={touched.phone ? errors.phone : undefined}
          hint="We'll send updates here."
          placeholder="9876543210"
          required
        />
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          required
          readOnly
          hint="Please use your own email, the one you'll have access to throughout the programme. To switch, sign out and sign back in with that account."
        />
      </div>

      {/* Education status — dropdown (before college, matching the apply form) */}
      <div className="mb-5">
        <label htmlFor="education" className="mb-1.5 block text-[13px] font-bold text-zinc-700">
          Current education status
          <span className="ml-0.5 text-red-600">*</span>
        </label>
        <div className="relative">
          <select
            id="education"
            value={education}
            onChange={(e) => {
              setEducation(e.target.value)
              markTouched('education')
            }}
            onBlur={() => markTouched('education')}
            className={`w-full appearance-none rounded-xl border-2 bg-zinc-50 px-3.5 py-3 pr-10 text-[15px] outline-none transition-all focus:border-[#16a34a] focus:bg-white focus:ring-4 focus:ring-[#16a34a]/15 ${
              touched.education && errors.education
                ? 'border-red-500 bg-red-50/40'
                : 'border-zinc-300'
            } ${education ? 'text-zinc-900' : 'text-zinc-400'}`}
          >
            <option value="" disabled>
              Choose a status
            </option>
            {EDUCATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="text-zinc-900">
                {opt}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={18}
            stroke={2}
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
        </div>
        {education === 'Other' && (
          <input
            type="text"
            value={educationOther}
            onChange={(e) => setEducationOther(e.target.value)}
            onBlur={() => markTouched('education')}
            placeholder="Tell us briefly"
            className={`mt-2 w-full rounded-xl border-2 bg-zinc-50 px-3.5 py-3 text-[15px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[#16a34a] focus:bg-white focus:ring-4 focus:ring-[#16a34a]/15 ${
              touched.education && errors.education ? 'border-red-500 bg-red-50/40' : 'border-zinc-300'
            }`}
          />
        )}
        {touched.education && errors.education && (
          <p className="mt-1.5 text-[12px] font-semibold text-red-600">{errors.education}</p>
        )}
      </div>

      <CollegeAutocomplete
        id="college"
        value={college}
        onChange={setCollege}
        onBlur={() => markTouched('college')}
        error={touched.college ? errors.college : undefined}
        hint="Start typing to search. If you don't see your college, just type the full name."
        placeholder="Start typing your college name…"
      />

      {/* How did you hear about us? */}
      <div className="mb-5">
        <label htmlFor="referral" className="mb-1.5 block text-[13px] font-bold text-zinc-700">
          How did you hear about us?
          <span className="ml-0.5 text-red-600">*</span>
        </label>
        <ReferralFields
          id="referral"
          source={referralSource}
          detail={referralDetail}
          onSource={changeReferralSource}
          onDetail={setReferralDetail}
          onBlur={() => markTouched('referral')}
          invalid={!!(touched.referral && errors.referral)}
        />
        {touched.referral && errors.referral && (
          <p className="mt-1.5 text-[12px] font-semibold text-red-600">{errors.referral}</p>
        )}
      </div>

      {submitError && (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-semibold text-red-700">
          {submitError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="group mt-2 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#0f1f0f] px-6 py-5 text-[15px] font-extrabold text-white shadow-sm transition-all hover:bg-[#15301a] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none sm:py-6 sm:text-[16px]"
      >
        {pending ? (
          'Submitting…'
        ) : (
          <>
            Submit application
            <IconArrowRight
              size={16}
              stroke={2.5}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </>
        )}
      </button>
    </form>
  )
}

const EDIT_INPUT_CLASS =
  'w-full rounded-xl border-2 border-zinc-300 bg-zinc-50 px-3.5 py-3 text-[15px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[#16a34a] focus:bg-white focus:ring-4 focus:ring-[#16a34a]/15'

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        <div className="mt-0.5 break-words text-[14px] font-semibold text-zinc-900 sm:text-[15px]">
          {value || <span className="text-zinc-400">—</span>}
        </div>
      </div>
    </div>
  )
}

function EditableRow({
  field,
  label,
  value,
  editingField,
  savingField,
  fieldError,
  anyEditing,
  onEdit,
  onCancel,
  onResubmit,
  children,
}: {
  field: EditableField
  label: string
  value: string
  editingField: EditableField | null
  savingField: boolean
  fieldError: string | null
  anyEditing: boolean
  onEdit: (f: EditableField) => void
  onCancel: () => void
  onResubmit: () => void
  children: React.ReactNode
}) {
  const isEditing = editingField === field
  const showEditButton = !anyEditing

  return (
    <div
      className={`rounded-xl border px-3.5 py-3 transition-colors ${
        isEditing ? 'border-[#16a34a]/40 bg-white' : 'border-zinc-200 bg-zinc-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
          {label}
        </div>
        {showEditButton && (
          <button
            type="button"
            onClick={() => onEdit(field)}
            className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-bold text-zinc-600 transition-colors hover:border-[#16a34a] hover:bg-[#f0fdf4] hover:text-[#166534]"
          >
            <IconPencil size={13} stroke={2.2} />
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-2">
          {children}
          {fieldError && (
            <p className="mt-1.5 text-[12px] font-semibold text-red-600">{fieldError}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onResubmit}
              disabled={savingField}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0f1f0f] px-4 py-2 text-[13px] font-extrabold text-white transition-all hover:bg-[#15301a] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {savingField ? 'Saving…' : 'Resubmit'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={savingField}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] font-bold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-0.5 break-words text-[14px] font-semibold text-zinc-900 sm:text-[15px]">
          {value || <span className="text-zinc-400">—</span>}
        </div>
      )}
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
  required,
  type = 'text',
  inputMode,
  maxLength,
  readOnly,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string
  hint?: string
  placeholder?: string
  required?: boolean
  type?: string
  inputMode?: 'numeric' | 'text' | 'email' | 'tel' | 'url'
  maxLength?: number
  readOnly?: boolean
}) {
  const inputClass = readOnly
    ? 'w-full cursor-not-allowed rounded-xl border-2 border-zinc-200 bg-zinc-100 px-3.5 py-3 text-[15px] text-zinc-500 outline-none'
    : `w-full rounded-xl border-2 bg-zinc-50 px-3.5 py-3 text-[15px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[#16a34a] focus:bg-white focus:ring-4 focus:ring-[#16a34a]/15 ${
        error ? 'border-red-500 bg-red-50/40' : 'border-zinc-300'
      }`

  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        className={inputClass}
      />
      {error ? (
        <p className="mt-1.5 text-[12px] font-semibold text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-zinc-500">{hint}</p>
      ) : null}
    </div>
  )
}

function ReferralFields({
  id,
  source,
  detail,
  onSource,
  onDetail,
  onBlur,
  invalid,
  variant = 'form',
}: {
  id: string
  source: string
  detail: string
  onSource: (v: string) => void
  onDetail: (v: string) => void
  onBlur?: () => void
  invalid?: boolean
  variant?: 'form' | 'edit'
}) {
  const kind = referralDetailKind(source)
  const base =
    variant === 'edit'
      ? EDIT_INPUT_CLASS
      : `w-full rounded-xl border-2 bg-zinc-50 px-3.5 py-3 text-[15px] outline-none transition-all focus:border-[#16a34a] focus:bg-white focus:ring-4 focus:ring-[#16a34a]/15 ${
          invalid ? 'border-red-500 bg-red-50/40' : 'border-zinc-300'
        }`

  return (
    <>
      <div className="relative">
        <select
          id={id}
          value={source}
          onChange={(e) => onSource(e.target.value)}
          onBlur={onBlur}
          className={`${base} appearance-none pr-10 ${source ? 'text-zinc-900' : 'text-zinc-400'}`}
        >
          <option value="" disabled>Choose an option</option>
          {REFERRAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="text-zinc-900">{o.value}</option>
          ))}
        </select>
        <IconChevronDown
          size={18}
          stroke={2}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
      </div>

      {kind === 'text' && (
        <input
          type="text"
          value={detail}
          onChange={(e) => onDetail(e.target.value)}
          onBlur={onBlur}
          placeholder={REFERRAL_OPTIONS.find((o) => o.value === source)?.detailLabel}
          className={`mt-2 ${base} ${variant === 'edit' ? '' : 'text-zinc-900 placeholder:text-zinc-400'}`}
        />
      )}

      {kind === 'platforms' && (
        <div className="relative mt-2">
          <select
            value={detail}
            onChange={(e) => onDetail(e.target.value)}
            onBlur={onBlur}
            className={`${base} appearance-none pr-10 ${detail ? 'text-zinc-900' : 'text-zinc-400'}`}
          >
            <option value="" disabled>
              {REFERRAL_OPTIONS.find((o) => o.value === source)?.detailLabel ?? 'Choose a platform'}
            </option>
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={p} className="text-zinc-900">{p}</option>
            ))}
          </select>
          <IconChevronDown
            size={18}
            stroke={2}
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
        </div>
      )}
    </>
  )
}

