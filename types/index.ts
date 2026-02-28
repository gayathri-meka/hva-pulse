import type { Session, User } from '@supabase/supabase-js'

export type { Session, User }

export type Learner = {
  learner_id: string
  user_id: string
  lf_user_id: string | null
  phone_number: string
  category: string
  lf_name: string
  status: string
  batch_name: string
  tech_mentor_name: string
  core_skills_mentor_name: string
  track: string
  join_date: string | null
  // Populated via join with users table:
  name: string
  email: string
}

export type Company = { id: string; company_name: string; sort_order?: number | null; created_at: string }

export type Role = {
  id: string; company_id: string; role_title: string; location: string
  salary_range: string | null; job_description: string
  jd_attachment_url?: string | null
  status: 'open' | 'closed'; created_at: string
}

export type RoleWithCounts = Role & { applicant_count: number; hired_count: number; not_interested_count: number }

export type CompanyWithRoles = Company & { roles: RoleWithCounts[] }

export type Application = {
  id: string; role_id: string; learner_id: string; user_id: string | null
  status: 'applied' | 'shortlisted' | 'on_hold' | 'not_shortlisted' | 'rejected' | 'hired'
  resume_url: string | null; created_at: string; updated_at: string
  not_shortlisted_reason: string | null
  rejection_feedback: string | null
}

export type ApplicationWithLearner = Application & {
  learner_name: string; learner_email: string
  company_name: string; role_title: string; location: string
}

export type Resume = {
  id: string; user_id: string; file_url: string; version_name: string; created_at: string
}

export type RolePreference = {
  id: string; user_id: string; role_id: string
  preference: 'not_interested'; reasons: string[]; created_at: string
}

export type MyStatus =
  | 'applied' | 'shortlisted' | 'on_hold' | 'not_shortlisted' | 'rejected' | 'hired'
  | 'not_interested' | 'not_applied'

export type JobPersona = {
  id: string; name: string
  target_job_titles: string[]; required_skills: string[]
  experience_min: number | null; experience_max: number | null
  preferred_locations: string[]; remote_allowed: boolean
  platforms: string[]; active: boolean
  created_by: string | null; created_at: string; updated_at: string
}

export type JobOpportunity = {
  id: string; persona_id: string | null
  job_title: string; company_name: string; location: string | null
  source_platform: string; date_posted: string | null
  job_description: string | null; match_reasoning: string | null
  original_url: string | null; external_id: string | null
  status: 'discovered' | 'reviewed' | 'approved' | 'rejected'
  notes: string | null; created_at: string; updated_at: string
}

export type JobOpportunityWithPersona = JobOpportunity & { persona_name: string | null }
