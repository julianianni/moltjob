import type { JobSeeker, JobPosting, MatchResult } from './types'

const WEIGHTS = {
  skills: 0.4,
  salary: 0.3,
  experience: 0.2,
  location: 0.1,
}

function scoreSkills(seekerSkills: string[], requiredSkills: string[], niceToHave: string[]): number {
  if (requiredSkills.length === 0) return 70

  const seekerLower = seekerSkills.map(s => s.toLowerCase())
  const requiredMatches = requiredSkills.filter(s =>
    seekerLower.includes(s.toLowerCase())
  ).length
  const niceMatches = niceToHave.filter(s =>
    seekerLower.includes(s.toLowerCase())
  ).length

  const requiredScore = (requiredMatches / requiredSkills.length) * 80
  const niceScore = niceToHave.length > 0
    ? (niceMatches / niceToHave.length) * 20
    : 20

  return requiredScore + niceScore
}

function scoreSalary(seeker: JobSeeker, job: JobPosting): number {
  if (!seeker.min_salary || !job.salary_max) return 50

  if (job.salary_max >= seeker.min_salary) return 100
  if (job.salary_min && seeker.max_salary && job.salary_min <= seeker.max_salary) return 70

  const gap = seeker.min_salary - (job.salary_max || 0)
  const percentage = gap / seeker.min_salary
  if (percentage <= 0.1) return 50
  if (percentage <= 0.2) return 30
  return 10
}

function scoreExperience(seekerYears: number, minRequired: number, maxRequired: number | null): number {
  if (seekerYears >= minRequired) {
    if (maxRequired && seekerYears > maxRequired + 5) return 60 // overqualified
    return 100
  }

  const gap = minRequired - seekerYears
  if (gap <= 1) return 70
  if (gap <= 2) return 40
  return 10
}

function scoreLocation(seeker: JobSeeker, job: JobPosting): number {
  if (seeker.remote_preference === 'any') return 80
  if (job.remote_type === 'remote' && seeker.remote_preference === 'remote') return 100
  if (job.remote_type === seeker.remote_preference) return 100

  if (job.location && seeker.preferred_locations.length > 0) {
    const jobLocationLower = job.location.toLowerCase()
    const match = seeker.preferred_locations.some(loc =>
      jobLocationLower.includes(loc.toLowerCase())
    )
    if (match) return 90
  }

  if (job.remote_type === 'hybrid') return 60
  return 30
}

export function matchJobsForSeeker(seeker: JobSeeker, jobs: JobPosting[]): MatchResult[] {
  const results: MatchResult[] = []

  for (const job of jobs) {
    const skills = scoreSkills(seeker.skills, job.required_skills, job.nice_to_have_skills)
    const salary = scoreSalary(seeker, job)
    const experience = scoreExperience(seeker.experience_years, job.experience_min, job.experience_max)
    const location = scoreLocation(seeker, job)

    const score =
      skills * WEIGHTS.skills +
      salary * WEIGHTS.salary +
      experience * WEIGHTS.experience +
      location * WEIGHTS.location

    results.push({
      job_posting: job,
      score: Math.round(score * 100) / 100,
      breakdown: { skills, salary, experience, location },
    })
  }

  return results.toSorted((a, b) => b.score - a.score)
}
