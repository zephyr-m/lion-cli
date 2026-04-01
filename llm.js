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
  async chatStream(messages, tools = [], onText, onEvent) {
    const body = { model: this.model, messages, max_tokens: 4096, temperature: 0.1, stream: true };
    if (tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
    if (onEvent) onEvent('request', { model: this.model, messages: messages.length, tools: tools.length });
    const res = await fetch(this.baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.apiKey },
      body: JSON.stringify(body)
    });
    if (!res.ok) { const err = await res.text(); throw new Error('API ' + res.status + ': ' + err.slice(0, 200)); }
    if (onEvent) onEvent('stream_start');
    const decoder = new TextDecoder();
    let buffer = '', content = '';
    const toolCalls = {};
    this.lastUsage = null;
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          if (json.usage) this.lastUsage = json.usage;
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) { content += delta.content; if (onText) onText(delta.content); }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls[idx]) toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) { toolCalls[idx].function.name += tc.function.name; if (onEvent) onEvent('tool_name', tc.function.name); }
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        } catch {}
      }
    }
    const msg = { role: 'assistant', content: content || null };
    const tcList = Object.values(toolCalls);
    if (tcList.length > 0) msg.tool_calls = tcList;
    if (onEvent) onEvent('stream_end');
    return msg;
  }
  getUsage() {
    if (!this.lastUsage) return null;
    return { prompt_tokens: this.lastUsage.prompt_tokens || 0, completion_tokens: this.lastUsage.completion_tokens || 0, total_tokens: this.lastUsage.total_tokens || 0 };
  }
}
