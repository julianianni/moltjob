import type { JobSeeker, JobPosting, MatchResult, DetailedMatchBreakdown, SkillMatchDetail } from './types'

const WEIGHTS = {
  skills: 0.4,
  salary: 0.3,
  experience: 0.2,
  location: 0.1,
}

function scoreSkills(
  seekerSkills: string[],
  requiredSkills: string[],
  niceToHave: string[],
  skillWeights: Record<string, number> | null
): number {
  if (requiredSkills.length === 0) return 70

  const seekerLower = seekerSkills.map(s => s.toLowerCase())

  let requiredScore: number
  if (skillWeights) {
    let totalWeight = 0
    let matchedWeight = 0
    for (const skill of requiredSkills) {
      const weight = skillWeights[skill] ?? 1
      totalWeight += weight
      if (seekerLower.includes(skill.toLowerCase())) {
        matchedWeight += weight
      }
    }
    requiredScore = totalWeight > 0 ? (matchedWeight / totalWeight) * 80 : 0
  } else {
    const requiredMatches = requiredSkills.filter(s =>
      seekerLower.includes(s.toLowerCase())
    ).length
    requiredScore = (requiredMatches / requiredSkills.length) * 80
  }

  let niceScore: number
  if (niceToHave.length > 0) {
    if (skillWeights) {
      let totalWeight = 0
      let matchedWeight = 0
      for (const skill of niceToHave) {
        const weight = skillWeights[skill] ?? 1
        totalWeight += weight
        if (seekerLower.includes(skill.toLowerCase())) {
          matchedWeight += weight
        }
      }
      niceScore = totalWeight > 0 ? (matchedWeight / totalWeight) * 20 : 0
    } else {
      const niceMatches = niceToHave.filter(s =>
        seekerLower.includes(s.toLowerCase())
      ).length
      niceScore = (niceMatches / niceToHave.length) * 20
    }
  } else {
    niceScore = 20
  }

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

export function getDetailedMatchBreakdown(
  seeker: JobSeeker,
  job: JobPosting
): DetailedMatchBreakdown {
  const skillsScore = scoreSkills(seeker.skills, job.required_skills, job.nice_to_have_skills, job.skill_weights)
  const salaryScore = scoreSalary(seeker, job)
  const experienceScore = scoreExperience(seeker.experience_years, job.experience_min, job.experience_max)
  const locationScore = scoreLocation(seeker, job)

  const overallScore =
    skillsScore * WEIGHTS.skills +
    salaryScore * WEIGHTS.salary +
    experienceScore * WEIGHTS.experience +
    locationScore * WEIGHTS.location

  const seekerLower = seeker.skills.map(s => s.toLowerCase())

  const requiredMatched: SkillMatchDetail[] = []
  const requiredMissing: SkillMatchDetail[] = []
  for (const skill of job.required_skills) {
    const weight = job.skill_weights?.[skill] ?? 1
    if (seekerLower.includes(skill.toLowerCase())) {
      requiredMatched.push({ skill, weight })
    } else {
      requiredMissing.push({ skill, weight })
    }
  }

  const niceMatched: SkillMatchDetail[] = []
  const niceMissing: SkillMatchDetail[] = []
  for (const skill of job.nice_to_have_skills) {
    const weight = job.skill_weights?.[skill] ?? 1
    if (seekerLower.includes(skill.toLowerCase())) {
      niceMatched.push({ skill, weight })
    } else {
      niceMissing.push({ skill, weight })
    }
  }

  const roundedScore = Math.round(overallScore * 100) / 100

  return {
    overall_score: roundedScore,
    threshold: job.min_match_score,
    passed: job.min_match_score === null || roundedScore >= job.min_match_score,
    breakdown: {
      skills: Math.round(skillsScore * 100) / 100,
      salary: Math.round(salaryScore * 100) / 100,
      experience: Math.round(experienceScore * 100) / 100,
      location: Math.round(locationScore * 100) / 100,
    },
    skill_details: {
      required_skills: { matched: requiredMatched, missing: requiredMissing },
      nice_to_have_skills: { matched: niceMatched, missing: niceMissing },
    },
  }
}

export function matchJobsForSeeker(seeker: JobSeeker, jobs: JobPosting[]): MatchResult[] {
  const results: MatchResult[] = []

  for (const job of jobs) {
    const skills = scoreSkills(seeker.skills, job.required_skills, job.nice_to_have_skills, job.skill_weights)
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
