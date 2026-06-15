// Shared logic for matching a marketing-form submission (learner_applications)
// to the Pulse signup it produced (prospects).
//
// Precedence: signup_token first, email second. The token is the robust link
// (survives the learner signing up with a different Google email); email is the
// fallback we rely on until the tokened signup flow is live on the form side,
// and for organic signups. Both surfaces (Website hits table, Analytics tab)
// import this so the definition of "signed up" can never drift between them.

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export type ProspectKey = {
  email:         string | null
  signup_token?: string | null
}

export type FormKey = {
  email:         string | null
  signup_token?: string | null
  // Set by the auth callback's write-back when a tokened signup completes.
  // Kept as a defensive third signal in case the prospect row is later removed.
  signed_up_at?: string | null
}

export type MatchMethod = 'token' | 'email' | null

export type SignupMatch = {
  matched: boolean
  method:  MatchMethod
  /** The Google email the person actually signed up with, when known. */
  prospectEmail: string | null
}

/** Pre-index prospects once, then match many form rows against it. */
export function buildProspectIndex(prospects: ProspectKey[]) {
  const byToken = new Map<string, string>() // token -> prospect email
  const byEmail = new Set<string>()
  for (const p of prospects) {
    const email = norm(p.email)
    if (email) byEmail.add(email)
    const token = p.signup_token?.trim()
    if (token) byToken.set(token, email)
  }
  return { byToken, byEmail }
}

export type ProspectIndex = ReturnType<typeof buildProspectIndex>

export function matchSignup(form: FormKey, index: ProspectIndex): SignupMatch {
  // 1. Token — the authoritative link.
  const token = form.signup_token?.trim()
  if (token && index.byToken.has(token)) {
    return { matched: true, method: 'token', prospectEmail: index.byToken.get(token) || null }
  }
  // 1b. Write-back stamp — a tokened signup definitely completed even if the
  //     prospect row can no longer be joined (e.g. it was deleted).
  if (form.signed_up_at) {
    return { matched: true, method: 'token', prospectEmail: null }
  }
  // 2. Email fallback.
  const email = norm(form.email)
  if (email && index.byEmail.has(email)) {
    return { matched: true, method: 'email', prospectEmail: email }
  }
  return { matched: false, method: null, prospectEmail: null }
}
