import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// OpenRouter via the OpenAI-compatible adapter (plan: AI layer — Provider).
// Free models only by default; the model id is env-configurable, never code.
export function getModel() {
  const provider = createOpenAICompatible({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'Eclipsay',
    },
  });
  return provider(process.env.OPENROUTER_MODEL ?? 'openrouter/free');
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}
