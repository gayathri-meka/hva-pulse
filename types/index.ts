import type { Session, User } from '@supabase/supabase-js'

export type { Session, User }

export type Learner = {
  learner_id: string
  name: string
  email: string
  phone_number: string
  category: string
  lf_name: string
  status: string
  batch_name: string
  tech_mentor_name: string
  core_skills_mentor_name: string
  track: string
  join_date: string | null
}
