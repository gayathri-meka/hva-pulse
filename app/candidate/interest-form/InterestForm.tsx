'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { IconArrowRight, IconCheck, IconChevronDown } from '@tabler/icons-react'
import CollegeAutocomplete from './CollegeAutocomplete'
import { submitInterestForm } from './actions'

const EDUCATION_OPTIONS = [
  'Completed 12th, not in college right now',
  'In college, graduating in 2026',
  'In college, graduating in 2027',
  'In college, graduating after 2027',
  'Graduated and working',
  'Graduated, not working',
  'Other',
]

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'college' | 'education', string>>

export default function InterestForm({
  defaultName,
  defaultEmail,
  defaultPhone,
  defaultCollege,
  defaultEducation,
  defaultEducationOther,
  firstName,
}: {
  defaultName: string
  defaultEmail: string
  defaultPhone: string
  defaultCollege: string
  defaultEducation: string
  defaultEducationOther: string
  firstName: string | null
}) {
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState(defaultPhone)
  const [email, setEmail] = useState(defaultEmail)
  const [college, setCollege] = useState(defaultCollege)
  const [education, setEducation] = useState(defaultEducation)
  const [educationOther, setEducationOther] = useState(defaultEducationOther)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validate(): Errors {
    const e: Errors = {}
    if (!name.trim()) e.name = 'Please enter your name'
    if (!/^\d{10}$/.test(phone)) e.phone = 'Enter a 10-digit number'
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Enter a valid email'
    if (!college.trim()) e.college = 'Please enter your college name'
    if (!education) e.education = 'Pick one'
    else if (education === 'Other' && !educationOther.trim()) e.education = 'Please tell us briefly'
    return e
  }

  const errors = validate()
  const isValid = Object.keys(errors).length === 0

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({ name: true, phone: true, email: true, college: true, education: true })
    if (!isValid) return
    setSubmitError(null)
    const educationValue = education === 'Other' ? educationOther.trim() : education
    startTransition(async () => {
      const result = await submitInterestForm({
        name: name.trim(),
        phone: phone.trim(),
        college: college.trim(),
        education_status: educationValue,
      })
      if (result.ok) {
        setSubmitted(true)
      } else {
        setSubmitError(result.error)
      }
    })
  }

  if (submitted) {
    return (
      <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-8 text-center sm:p-12">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7]">
          <IconCheck size={28} stroke={2.5} className="text-[#16a34a]" />
        </div>
        <h2
          className="mb-2 text-[22px] font-black text-zinc-900 sm:text-[26px]"
          style={{ fontFamily: 'var(--font-jakarta), sans-serif', lineHeight: 1.25 }}
        >
          {firstName ? `Thanks, ${firstName}!` : 'Thanks!'}
        </h2>
        <p className="mx-auto mb-6 max-w-[440px] text-[14px] leading-[1.6] text-zinc-600 sm:text-[15px]">
          Your interest is recorded. We&apos;ll review your details and reach out within 3 working days about the next step.
        </p>
        <Link
          href="/candidate/challenge"
          className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f1f0f] px-6 py-3.5 text-[14px] font-extrabold text-white transition-all hover:bg-[#15301a] hover:shadow-md active:scale-[0.99]"
        >
          See what&apos;s next
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

      <CollegeAutocomplete
        id="college"
        value={college}
        onChange={setCollege}
        onBlur={() => markTouched('college')}
        error={touched.college ? errors.college : undefined}
        hint="Start typing to search. If you don't see your college, just type the full name."
        placeholder="Start typing your college name…"
      />

      {/* Education status — dropdown */}
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

