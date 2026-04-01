# 🦁 Lion

AI coding agent for the terminal. Like Claude Code, but for **DeepSeek**, **Gemini**, or any OpenAI-compatible LLM.

## Install & Run

```bash
npm i -g lionai-cli
lion .
```

First launch asks for provider and API key. That's it.

## Features

- **Streaming** — responses appear token by token
- **Tool-use** — reads/writes files, runs commands, searches code
- **Sessions** — stored in SQLite (`~/.lion/lion.db`)
- **Token tracking** — per-request and per-session usage
- **Debug mode** — `/debug` shows exactly what goes to the cloud and back
- **Zero config** — first run wizard handles everything

## Commands

| Command | Description |
|---|---|
| `/debug` | Toggle full request/response transparency |
| `/sessions` | List saved sessions |
| `/usage` | Token usage stats |
| `/new` | Start new session |
| `/clear` | Clear context |
| `/config` | Change provider/key |
| `/help` | Show all commands |
| `/exit` | Quit |

## Providers

Works with any OpenAI-compatible API:
- DeepSeek
- Gemini
- OpenAI
- Custom endpoint (local LLMs via Ollama, LM Studio, etc.)

## License

MIT
