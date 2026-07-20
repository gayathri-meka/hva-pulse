import OpenAI from 'openai'

// Thin server-side OpenAI wrapper. Kept separate so callers (server actions) can
// be unit-tested by mocking '@/lib/openai' without touching the SDK.

let client: OpenAI | null = null
function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OpenAI is not configured — set OPENAI_API_KEY.')
  if (!client) client = new OpenAI({ apiKey: key })
  return client
}

/**
 * Run a single chat completion in JSON mode and return the raw JSON string
 * (parsing is the caller's job so it can validate/normalise the shape).
 */
export async function chatJSON({
  system,
  user,
  model = 'gpt-4o',
  temperature = 0.2,
}: {
  system: string
  user: string
  model?: string
  temperature?: number
}): Promise<string> {
  const res = await getClient().chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  return res.choices[0]?.message?.content ?? ''
}
