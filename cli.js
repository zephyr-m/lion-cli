#!/usr/bin/env node
/**
 * Lion — AI coding agent for the terminal.
 * Usage: lion [cwd]
 */
import { createInterface } from 'readline';
import { LLM, PROVIDERS } from './llm.js';
import { agentLoop } from './agent.js';
import {
  getProvider, setProvider, setConfig, getConfig,
  createSession, listSessions, getSession, getMessages,
  updateSessionTitle, getSessionUsage, getTotalUsage
} from './store.js';

const C = {
  r: '\x1b[0m', d: '\x1b[2m', c: '\x1b[36m', g: '\x1b[32m',
  y: '\x1b[33m', m: '\x1b[35m', b: '\x1b[1m', red: '\x1b[31m'
};

const cwd = process.argv[2] || process.cwd();

async function setup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log(`\n${C.b}${C.y}🦁 Lion${C.r} — первый запуск\n`);
  console.log('Выберите провайдера:');
  console.log(`  ${C.c}1${C.r}. DeepSeek`);
  console.log(`  ${C.c}2${C.r}. Gemini`);
  console.log(`  ${C.c}3${C.r}. OpenAI`);
  console.log(`  ${C.c}4${C.r}. Custom (свой URL)\n`);

  const choice = await ask(`${C.y}>${C.r} `);
  let provider, customUrl, customModel;

  switch (choice.trim()) {
    case '1': provider = 'deepseek'; break;
    case '2': provider = 'gemini'; break;
    case '3': provider = 'openai'; break;
    case '4':
      provider = 'custom';
      customUrl = await ask(`Base URL: `);
      customModel = await ask(`Model: `);
      setConfig('custom_url', customUrl);
      setConfig('custom_model', customModel);
      break;
    default: provider = 'deepseek';
  }

  let key = '';
  while (!key) {
    key = (await ask(`\nAPI Key: `)).trim();
    if (!key || !/^[\x20-\x7E]+$/.test(key)) {
      console.log(`${C.red}❌ Невалидный ключ (только ASCII символы)${C.r}`);
      key = '';
    }
  }
  setProvider({ provider, apiKey: key });
  console.log(`\n${C.g}✅ Сохранено!${C.r}\n`);
  rl.close();
  return { provider, apiKey: key, customUrl, customModel };
}

async function main() {
  let config = getProvider();
  if (!config) {
    config = await setup();
  }

  const { provider, apiKey } = config;
  const customUrl = getConfig('custom_url');
  const customModel = getConfig('custom_model');
  const llm = new LLM(provider, apiKey, customUrl, customModel);

  // Create session
  const sessionId = createSession(cwd, provider, llm.model);

  const SYSTEM = `You are Lion, a sovereign coding agent. You have tools for reading/writing files, running commands, and searching code.
Rules:
- Be concise and precise.
- Use tools to explore before making changes.
- Current working directory: ${cwd}`;

  const messages = [{ role: 'system', content: SYSTEM }];

  console.log(`${C.b}${C.y}🦁 Lion${C.r} ${C.d}— ${llm.providerName} / ${llm.model}${C.r}`);
  console.log(`${C.d}cwd: ${cwd} | session #${sessionId}${C.r}\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: `${C.y}❯${C.r} ` });
  rl.prompt();

  rl.on('line', async (input) => {
    const line = input.trim();
    if (!line) { rl.prompt(); return; }

    // Commands
    if (line === '/exit' || line === '/q') process.exit(0);
    if (line === '/clear') { messages.length = 1; console.log('Context cleared.'); rl.prompt(); return; }
    if (line === '/new') {
      const newId = createSession(cwd, provider, llm.model);
      messages.length = 1;
      console.log(`New session #${newId}`);
      rl.prompt(); return;
    }
    if (line === '/sessions') {
      const sessions = listSessions();
      console.log(`\n${C.b}Sessions:${C.r}`);
      for (const s of sessions) {
        const title = s.title || '(untitled)';
        console.log(`  ${C.c}#${s.id}${C.r} ${title} ${C.d}| ${s.tokens_in + s.tokens_out} tok | ${s.created_at}${C.r}`);
      }
      console.log('');
      rl.prompt(); return;
    }
    if (line === '/usage') {
      const total = getTotalUsage();
      const sess = getSessionUsage(sessionId);
      console.log(`\n${C.b}Usage:${C.r}`);
      console.log(`  Session: ↑${sess?.tokens_in || 0} ↓${sess?.tokens_out || 0} = ${sess?.total || 0} tok`);
      console.log(`  Total:   ↑${total.tokens_in} ↓${total.tokens_out} = ${total.total} tok\n`);
      rl.prompt(); return;
    }
    if (line === '/help') {
      console.log(`\n${C.b}Commands:${C.r}`);
      console.log('  /sessions  — list sessions');
      console.log('  /usage     — token usage');
      console.log('  /new       — new session');
      console.log('  /clear     — clear context');
      console.log('  /config    — reconfigure provider');
      console.log('  /exit      — quit\n');
      rl.prompt(); return;
    }
    if (line === '/config') {
      setProvider(null);
      const cfg = await setup();
      console.log('Restart lion to apply changes.');
      process.exit(0);
    }

    messages.push({ role: 'user', content: line });

    try {
      await agentLoop(llm, messages, sessionId, cwd);
    } catch (err) {
      console.error(`${C.red}Error: ${err.message}${C.r}`);
    }

    rl.prompt();
  });
}

main().catch(err => {
  console.error(`${C.red}Fatal: ${err.message}${C.r}`);
  process.exit(1);
});
