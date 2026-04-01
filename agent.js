import { toolDefs, executeTool } from './tools.js';
import { addMessage, getSessionUsage } from './store.js';
const C = { r: '\x1b[0m', d: '\x1b[2m', c: '\x1b[36m', g: '\x1b[32m', y: '\x1b[33m', m: '\x1b[35m', b: '\x1b[1m', red: '\x1b[31m' };

export let debug = false;
export function toggleDebug() { debug = !debug; return debug; }

function debugLog(label, data) {
  if (!debug) return;
  console.log(C.c + '┌─ ' + label + ' ─────────────────────' + C.r);
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  // Truncate long values for readability
  const lines = str.split('\n');
  for (const line of lines) {
    console.log(C.c + '│ ' + C.d + line + C.r);
  }
  console.log(C.c + '└────────────────────────────' + C.r);
}

export async function agentLoop(llm, messages, sessionId, cwd) {
  let iterations = 0, MAX = 15, reqIn = 0, reqOut = 0;
  while (iterations < MAX) {
    iterations++;
    process.stdout.write(C.d + '→ ' + llm.providerName + '/' + llm.model + ' (' + messages.length + ' msgs)...' + C.r + '\n');

    if (debug) {
      debugLog('REQUEST → ' + llm.baseUrl, {
        model: llm.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content ? (m.content.length > 200 ? m.content.slice(0, 200) + '...' : m.content) : null,
          tool_calls: m.tool_calls ? m.tool_calls.map(tc => tc.function.name) : undefined,
          tool_call_id: m.tool_call_id
        })),
        tools: toolDefs.map(t => t.function.name)
      });
    }

    let textStarted = false;
    const response = await llm.chatStream(messages, toolDefs,
      (chunk) => {
        if (!textStarted) { textStarted = true; process.stdout.write('\n'); }
        process.stdout.write(chunk);
      },
      (event, data) => {
        if (event === 'tool_name') process.stdout.write(C.m + '\n⚡ calling: ' + data + C.r);
        if (event === 'stream_end' && textStarted) process.stdout.write('\n');
      }
    );

    const usage = llm.getUsage();
    if (usage) { reqIn += usage.prompt_tokens; reqOut += usage.completion_tokens; }

    if (debug) {
      debugLog('RESPONSE ← ' + (usage ? ('↑' + usage.prompt_tokens + ' ↓' + usage.completion_tokens) : ''), {
        content: response.content ? (response.content.length > 300 ? response.content.slice(0, 300) + '...' : response.content) : null,
        tool_calls: response.tool_calls?.map(tc => ({ name: tc.function.name, args: tc.function.arguments }))
      });
    }

    if (response.content) {
      addMessage(sessionId, 'assistant', response.content, usage?.prompt_tokens || 0, usage?.completion_tokens || 0);
    }
    if (!response.tool_calls || response.tool_calls.length === 0) {
      messages.push({ role: 'assistant', content: response.content || '' });
      break;
    }
    messages.push(response);
    for (const tc of response.tool_calls) {
      const name = tc.function.name;
      let args;
      try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
      const argsStr = Object.entries(args).map(([k,v]) => {
        const val = typeof v === 'string' && v.length > 50 ? v.slice(0,50)+'...' : v;
        return k + '=' + val;
      }).join(' ');
      console.log(C.m + '⚡ ' + name + C.r + ' ' + C.d + argsStr + C.r);
      const result = executeTool(name, args, cwd);
      const preview = result.length > 300 ? result.slice(0, 300) + '\n' + C.d + '... (' + result.length + ' chars)' + C.r : result;
      console.log(C.d + preview + C.r + '\n');
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }
  const sess = getSessionUsage(sessionId);
  console.log(C.d + '↑ ' + reqIn + ' tok  ↓ ' + reqOut + ' tok  = ' + (reqIn+reqOut) + ' tok  │  Сессия: ' + (sess?.total||0) + ' tok' + C.r + '\n');
}
