/**
 * LLM — OpenAI-compatible API wrapper with token counting.
 */
const PROVIDERS = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', name: 'DeepSeek' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', name: 'Gemini' },
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini', name: 'OpenAI' }
};

export { PROVIDERS };

export class LLM {
  constructor(provider, apiKey, customUrl, customModel) {
    const p = PROVIDERS[provider] || {};
    this.baseUrl = customUrl || p.baseUrl || 'https://api.deepseek.com';
    this.model = customModel || p.model || 'deepseek-chat';
    this.apiKey = apiKey;
    this.providerName = p.name || provider;
    this.lastUsage = null;
  }

  async chat(messages, tools = []) {
    const body = {
      model: this.model,
      messages,
      max_tokens: 4096,
      temperature: 0.1,
      stream: false
    };
    if (tools.length) { body.tools = tools; body.tool_choice = 'auto'; }

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    this.lastUsage = data.usage || null;
    return data.choices[0].message;
  }

  getUsage() {
    if (!this.lastUsage) return null;
    return {
      prompt_tokens: this.lastUsage.prompt_tokens || 0,
      completion_tokens: this.lastUsage.completion_tokens || 0,
      total_tokens: this.lastUsage.total_tokens || 0
    };
  }
}
