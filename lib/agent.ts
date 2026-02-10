import Anthropic from '@anthropic-ai/sdk'
import type { JobSeeker, JobPosting } from './types'

const anthropic = new Anthropic()

export async function generateCoverMessage(
  seeker: JobSeeker,
  job: JobPosting
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are an AI agent applying to a job on behalf of a candidate. Write a brief, professional application message.

CANDIDATE:
Name: ${seeker.full_name}
Skills: ${seeker.skills.join(', ')}
Experience: ${seeker.experience_years} years
Resume: ${seeker.resume_text.slice(0, 1000)}

JOB:
Title: ${job.title}
Company: ${job.company_name || 'Company'}
Description: ${job.description.slice(0, 500)}
Required Skills: ${job.required_skills.join(', ')}

Write a concise 2-3 paragraph application message highlighting relevant skills and experience. Be professional but direct. Do not use flowery language.`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type === 'text') {
    return block.text
  }
  return 'Application submitted by AI agent.'
}

export async function generateAgentReply(
  seeker: JobSeeker,
  job: JobPosting,
  employerMessage: string
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `You are an AI agent representing a job candidate in a conversation with an employer. Reply to their message professionally.

CANDIDATE:
Name: ${seeker.full_name}
Skills: ${seeker.skills.join(', ')}
Experience: ${seeker.experience_years} years

JOB:
Title: ${job.title}

EMPLOYER MESSAGE:
${employerMessage}

Reply concisely and professionally. If they ask about scheduling a meeting or interview, confirm the candidate's availability and ask for proposed times. If you don't know specific details about the candidate that aren't in the profile, say you'll check with the candidate and get back to them.`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type === 'text') {
    return block.text
  }
  return 'Thank you for your message. I will get back to you shortly.'
}
