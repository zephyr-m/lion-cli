/**
 * Agent — tool-use loop with token tracking per request.
 */
import { toolDefs, executeTool } from './tools.js';
import { addMessage, getSessionUsage } from './store.js';

const C = {
  r: '\x1b[0m', d: '\x1b[2m', c: '\x1b[36m', g: '\x1b[32m',
  y: '\x1b[33m', m: '\x1b[35m', b: '\x1b[1m'
};

export async function agentLoop(llm, messages, sessionId, cwd) {
  let iterations = 0;
  const MAX = 15;
  let reqIn = 0, reqOut = 0;

  while (iterations < MAX) {
    iterations++;
    const response = await llm.chat(messages, toolDefs);
    const usage = llm.getUsage();
    if (usage) { reqIn += usage.prompt_tokens; reqOut += usage.completion_tokens; }

    if (response.content) {
      console.log(`\n${response.content}`);
      addMessage(sessionId, 'assistant', response.content, usage?.prompt_tokens || 0, usage?.completion_tokens || 0);
    }

    if (!response.tool_calls || response.tool_calls.length === 0) {
      messages.push({ role: 'assistant', content: response.content || '' });
      break;
    }

    messages.push(response);

    for (const tc of response.tool_calls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments);
      const argsStr = Object.entries(args).map(([k,v]) => {
        const val = typeof v === 'string' && v.length > 50 ? v.slice(0,50)+'...' : v;
        return `${k}=${val}`;
      }).join(' ');
      console.log(`${C.m}⚡ ${name}${C.r} ${C.d}${argsStr}${C.r}`);

      const result = executeTool(name, args, cwd);
      const preview = result.length > 300 ? result.slice(0, 300) + `\n${C.d}... (${result.length} chars)${C.r}` : result;
      console.log(`${C.d}${preview}${C.r}\n`);

      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }

  // Token stats
  const sess = getSessionUsage(sessionId);
  const statsLine = [
    `${C.d}↑ ${reqIn} tok`,
    `↓ ${reqOut} tok`,
    `= ${reqIn + reqOut} tok`,
    `│ Сессия: ${sess?.total || 0} tok${C.r}`
  ].join('  ');
  console.log(`\n${statsLine}\n`);
}
