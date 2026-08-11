import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.LLM_API_KEY || ''
  const model = process.env.LLM_MODEL || 'llama-3.1-8b-instant'

  if (!apiKey || apiKey.startsWith('your-')) {
    return res.status(500).json({ error: 'LLM_API_KEY not set or still placeholder', keyPresent: !!apiKey, keyPrefix: apiKey ? apiKey.substring(0, 4) : 'none' })
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say hello in one word' }],
        max_tokens: 10
      })
    })

    const body = await response.text()

    if (!response.ok) {
      return res.status(500).json({ error: `Groq API returned ${response.status}`, body: body.substring(0, 500), model })
    }

    const data = JSON.parse(body)
    return res.status(200).json({ success: true, response: data.choices[0]?.message?.content, model, provider: 'groq' })
  } catch (error: any) {
    return res.status(500).json({ error: error.message, model })
  }
}
