#!/usr/bin/env node
/**
 * Lion — автотесты (store, tools, llm)
 */
import assert from 'assert';
import { existsSync, unlinkSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// === Test Store ===
console.log('\n🧪 Testing Store...');

// Reset test DB
import { homedir } from 'os';
const testDb = join(homedir(), '.lion', 'lion.db');
if (existsSync(testDb)) unlinkSync(testDb);

const {
  setConfig, getConfig, setProvider, getProvider,
  createSession, getSession, listSessions, updateSessionTitle,
  addMessage, getMessages, getSessionUsage, getTotalUsage
} = await import('./store.js');

// Config
setConfig('test_key', 'test_value');
assert.strictEqual(getConfig('test_key'), 'test_value');
console.log('  ✅ setConfig / getConfig');

// Provider
setProvider({ provider: 'deepseek', apiKey: 'sk-test123' });
const prov = getProvider();
assert.strictEqual(prov.provider, 'deepseek');
assert.strictEqual(prov.apiKey, 'sk-test123');
console.log('  ✅ setProvider / getProvider');

// Sessions
const sid1 = createSession('/tmp/test', 'deepseek', 'deepseek-chat');
const sid2 = createSession('/tmp/test2', 'gemini', 'gemini-2.0-flash');
assert.ok(sid1 > 0);
assert.ok(sid2 > sid1);
const s = getSession(sid1);
assert.strictEqual(s.cwd, '/tmp/test');
assert.strictEqual(s.provider, 'deepseek');
console.log('  ✅ createSession / getSession');

const sessions = listSessions();
assert.ok(sessions.length >= 2);
console.log('  ✅ listSessions');

updateSessionTitle(sid1, 'Test Session');
assert.strictEqual(getSession(sid1).title, 'Test Session');
console.log('  ✅ updateSessionTitle');

// Messages + Usage
addMessage(sid1, 'user', 'hello', 10, 0);
addMessage(sid1, 'assistant', 'hi there', 10, 25);
addMessage(sid1, 'user', 'bye', 15, 0);
addMessage(sid1, 'assistant', 'see ya', 15, 20);

const msgs = getMessages(sid1);
assert.strictEqual(msgs.length, 4);
assert.strictEqual(msgs[0].content, 'hello');
console.log('  ✅ addMessage / getMessages');

const usage = getSessionUsage(sid1);
assert.strictEqual(usage.tokens_in, 50);  // 10+10+15+15
assert.strictEqual(usage.tokens_out, 45); // 0+25+0+20
assert.strictEqual(usage.total, 95);
console.log('  ✅ getSessionUsage (in:50 out:45 total:95)');

const total = getTotalUsage();
assert.ok(total.tokens_in >= 50);
console.log('  ✅ getTotalUsage');

// === Test Tools ===
console.log('\n🧪 Testing Tools...');

import { executeTool } from './tools.js';

// Setup test dir
const testDir = join(import.meta.dirname, '__test_tmp__');
if (existsSync(testDir)) rmSync(testDir, { recursive: true });
mkdirSync(testDir);

// write_file
const wResult = executeTool('write_file', { path: 'hello.txt', content: 'Hello Lion!' }, testDir);
assert.ok(wResult.includes('Written'));
console.log('  ✅ write_file');

// read_file
const rResult = executeTool('read_file', { path: 'hello.txt' }, testDir);
assert.strictEqual(rResult, 'Hello Lion!');
console.log('  ✅ read_file');

// list_dir
const lResult = executeTool('list_dir', { path: '.' }, testDir);
assert.ok(lResult.includes('hello.txt'));
console.log('  ✅ list_dir');

// run_command
const cResult = executeTool('run_command', { command: 'echo test123' }, testDir);
assert.ok(cResult.includes('test123'));
console.log('  ✅ run_command');

// search_files
const sResult = executeTool('search_files', { pattern: 'Lion', path: '.' }, testDir);
assert.ok(sResult.includes('hello.txt'));
console.log('  ✅ search_files');

// Cleanup
rmSync(testDir, { recursive: true });

// === Test LLM ===
console.log('\n🧪 Testing LLM...');

import { LLM, PROVIDERS } from './llm.js';

assert.ok(PROVIDERS.deepseek);
assert.ok(PROVIDERS.gemini);
assert.ok(PROVIDERS.openai);
console.log('  ✅ PROVIDERS defined');

const llm = new LLM('deepseek', 'sk-fake', null, null);
assert.strictEqual(llm.baseUrl, 'https://api.deepseek.com');
assert.strictEqual(llm.model, 'deepseek-chat');
assert.strictEqual(llm.apiKey, 'sk-fake');
console.log('  ✅ LLM constructor (deepseek)');

const llm2 = new LLM('gemini', 'key', null, null);
assert.strictEqual(llm2.model, 'gemini-2.0-flash');
console.log('  ✅ LLM constructor (gemini)');

const llm3 = new LLM('custom', 'key', 'http://localhost:1234', 'my-model');
assert.strictEqual(llm3.baseUrl, 'http://localhost:1234');
assert.strictEqual(llm3.model, 'my-model');
console.log('  ✅ LLM constructor (custom)');

// === Summary ===
console.log('\n✅ All tests passed!\n');

// Cleanup DB
unlinkSync(testDb);
