/**
 * PII masking for guest users.
 *
 * Replaces learner names, emails, phone numbers, and mentor names
 * with anonymized placeholders. Applied server-side before data
 * reaches client components — guests never receive real PII.
 */

/** Replace a learner's name with an anonymized label. */
export function maskName(name: string | null, learnerId?: string): string {
  if (!name) return '—'
  return learnerId ? `Learner ${learnerId}` : '***'
}

/** Hide an email address entirely. */
export function maskEmail(_email: string | null): string {
  return '***@***.com'
}

/** Hide a phone number. */
export function maskPhone(_phone: string | null): string {
  return '***'
}

/** Hide mentor/tech mentor names. */
export function maskMentor(_name: string | null): string {
  return '***'
}

/**
 * Apply PII masking to a learner-shaped object.
 * Mutates nothing — returns a new object with masked fields.
 */
export function maskLearnerPII<T extends Record<string, unknown>>(
  row: T,
  learnerId?: string,
): T {
  const masked: Record<string, unknown> = { ...row }

  // Name fields
  if ('name' in masked && typeof masked.name === 'string') {
    masked.name = maskName(masked.name as string, learnerId)
  }
  if ('learner_name' in masked && typeof masked.learner_name === 'string') {
    masked.learner_name = maskName(masked.learner_name as string, learnerId)
  }

  // Email
  if ('email' in masked && typeof masked.email === 'string') {
    masked.email = maskEmail(masked.email as string)
  }

  // Phone
  if ('phone_number' in masked && typeof masked.phone_number === 'string') {
    masked.phone_number = maskPhone(masked.phone_number as string)
  }

  // Mentor names
  if ('tech_mentor_name' in masked && typeof masked.tech_mentor_name === 'string') {
    masked.tech_mentor_name = maskMentor(masked.tech_mentor_name as string)
  }
  if ('core_skills_mentor_name' in masked && typeof masked.core_skills_mentor_name === 'string') {
    masked.core_skills_mentor_name = maskMentor(masked.core_skills_mentor_name as string)
  }

  return masked as T
}
