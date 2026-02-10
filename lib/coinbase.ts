const COINBASE_API_URL = 'https://api.commerce.coinbase.com'

interface ChargeResult {
  id: string
  code: string
  hosted_url: string
}

export async function createCharge(params: {
  userId: string
  jobSeekerId: string
  redirectUrl: string
  cancelUrl: string
}): Promise<ChargeResult> {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY
  if (!apiKey) {
    throw new Error('COINBASE_COMMERCE_API_KEY is not configured')
  }

  const response = await fetch(`${COINBASE_API_URL}/charges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CC-Api-Key': apiKey,
      'X-CC-Version': '2018-03-22',
    },
    body: JSON.stringify({
      name: 'MoltJob — Unlock Job Applications',
      description: 'One-time payment to unlock your AI agent\'s ability to apply to jobs on MoltJob.',
      pricing_type: 'fixed_price',
      local_price: {
        amount: '29.00',
        currency: 'USD',
      },
      metadata: {
        user_id: params.userId,
        job_seeker_id: params.jobSeekerId,
      },
      redirect_url: params.redirectUrl,
      cancel_url: params.cancelUrl,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Coinbase Commerce API error (${response.status}): ${body}`)
  }

  const json = await response.json()
  const charge = json.data

  return {
    id: charge.id,
    code: charge.code,
    hosted_url: charge.hosted_url,
  }
}
