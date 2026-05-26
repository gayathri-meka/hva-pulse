// Returns a tagged reason if a learner is blocked from applying to roles
// (Apply / Not Interested actions), or null if they can apply.
//
// Server actions and learner UI both call this so the message stays
// consistent. UI uses the `type` to choose tone (placed → celebrate;
// exited → grey; next-cycle → informational). Messages have no trailing
// punctuation; callers add it.
export type ApplyBlock = {
  type:    'exited' | 'placed' | 'next-cycle'
  message: string
}

export function getApplyBlockReason(status: string | null | undefined): ApplyBlock | null {
  if (status === 'Dropout' || status === 'Discontinued') {
    return { type: 'exited', message: 'Discontinued / Dropped out learners cannot apply' }
  }
  if (status === 'Placed - HVA' || status === 'Placed - Self') {
    return { type: 'placed', message: 'You are already placed and cannot apply to new roles' }
  }
  if (status === 'Join Next Cycle') {
    return { type: 'next-cycle', message: 'You are joining the next cycle and cannot apply to current roles' }
  }
  return null
}
