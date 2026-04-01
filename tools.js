/**
 * Tools — file system + shell tools for the agent
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname, resolve } from 'path';

/** Tool definitions for OpenAI-compatible function calling */
export const toolDefs = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (absolute or relative to cwd)' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with content',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'File content to write' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command and return stdout+stderr',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and directories in a path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: cwd)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for a pattern in files using grep',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern (regex)' },
          path: { type: 'string', description: 'Directory to search in (default: cwd)' },
          glob: { type: 'string', description: 'File glob filter (e.g. "*.js")' }
        },
        required: ['pattern']
      }
    }
  }
];

/** Execute a tool call */
export function executeTool(name, args, cwd) {
  try {
    switch (name) {
      case 'read_file': {
        const p = resolve(cwd, args.path);
        if (!existsSync(p)) return `Error: file not found: ${p}`;
        return readFileSync(p, 'utf-8');
      }
      case 'write_file': {
        const p = resolve(cwd, args.path);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, args.content);
        return `Written ${args.content.length} bytes to ${p}`;
      }
      case 'run_command': {
        const out = execSync(args.command, { cwd, timeout: 30000, encoding: 'utf-8', maxBuffer: 1024*1024 });
        return out || '(no output)';
      }
      case 'list_dir': {
        const dir = resolve(cwd, args.path || '.');
        const items = readdirSync(dir);
        return items.map(f => {
          const s = statSync(join(dir, f));
          return `${s.isDirectory() ? 'd' : 'f'} ${f}`;
        }).join('\n');
      }
      case 'search_files': {
        const dir = resolve(cwd, args.path || '.');
        const glob = args.glob ? `--include="${args.glob}"` : '';
        const out = execSync(`grep -rnI ${glob} "${args.pattern}" "${dir}" 2>/dev/null | head -50`, { encoding: 'utf-8', timeout: 10000 });
        return out || 'No matches found';
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Error: ${err.message}`;
  }
}
