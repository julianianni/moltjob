export interface User {
  id: string
  email: string
  role: 'job_seeker' | 'employer'
  created_at: string
}

export interface JobSeeker {
  id: string
  user_id: string
  full_name: string
  resume_text: string
  skills: string[]
  preferred_job_titles: string[]
  preferred_locations: string[]
  min_salary: number | null
  max_salary: number | null
  experience_years: number
  remote_preference: 'remote' | 'onsite' | 'hybrid' | 'any'
  has_paid: boolean
  created_at: string
}

export interface Employer {
  id: string
  user_id: string
  company_name: string
  company_description: string | null
  industry: string | null
  company_size: string | null
  website: string | null
  created_at: string
}

export interface JobPosting {
  id: string
  employer_id: string
  title: string
  description: string
  required_skills: string[]
  nice_to_have_skills: string[]
  skill_weights: Record<string, number> | null
  min_match_score: number | null
  location: string | null
  remote_type: 'remote' | 'onsite' | 'hybrid'
  salary_min: number | null
  salary_max: number | null
  experience_min: number
  experience_max: number | null
  status: 'active' | 'paused' | 'closed' | 'filled'
  created_at: string
  // Joined fields
  company_name?: string
}

export interface Application {
  id: string
  job_seeker_id: string
  job_posting_id: string
  status: 'pending' | 'reviewing' | 'shortlisted' | 'interview_scheduled' | 'rejected' | 'accepted'
  match_score: number
  cover_message: string | null
  employer_notes: string | null
  created_at: string
  // Joined fields
  job_title?: string
  company_name?: string
  seeker_name?: string
  conversation_id?: string
}

export interface Conversation {
  id: string
  application_id: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: 'agent' | 'employer' | 'system'
  content: string
  read_at: string | null
  created_at: string
  // Joined fields (for polling endpoint)
  application_id?: string
  job_title?: string
  company_name?: string
}

export interface ApiKey {
  id: string
  user_id: string
  key_prefix: string
  name: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface ActivityLogEntry {
  id: string
  user_id: string
  api_key_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export interface Rating {
  id: string
  job_seeker_id: string
  employer_id: string
  application_id: string
  score: number
  feedback: string | null
  created_at: string
}

export interface MatchResult {
  job_posting: JobPosting
  score: number
  breakdown: {
    skills: number
    salary: number
    experience: number
    location: number
  }
}

export interface SkillMatchDetail {
  skill: string
  weight: number
}

export interface DetailedMatchBreakdown {
  overall_score: number
  threshold: number | null
  passed: boolean
  breakdown: {
    skills: number
    salary: number
    experience: number
    location: number
  }
  skill_details: {
    required_skills: {
      matched: SkillMatchDetail[]
      missing: SkillMatchDetail[]
    }
    nice_to_have_skills: {
      matched: SkillMatchDetail[]
      missing: SkillMatchDetail[]
    }
  }
}

export interface Payment {
  id: string
  user_id: string
  job_seeker_id: string
  coinbase_charge_id: string
  coinbase_charge_code: string | null
  status: string
  amount_usd: number
  hosted_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentMapping {
  id: string
  user_id: string
  agent_id: string
  agent_hosting: 'hosted' | 'byoa'
  onboarding_session_id: string | null
  created_at: string
  updated_at: string
}

export interface AuthPayload {
  userId: string
  email: string
  role: 'job_seeker' | 'employer'
}
