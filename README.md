<div align="center">

# HelixMind

**Open Source AI Coding Agent with Persistent Spiral Memory**

[![npm version](https://img.shields.io/npm/v/helixmind?color=blue&logo=npm)](https://www.npmjs.com/package/helixmind)
[![License](https://img.shields.io/badge/License-AGPL_3.0-blue?logo=gnu)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18%2B-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-979_passing-brightgreen)](https://github.com/DancingTedDanson011/HelixMind)

*An autonomous coding agent that remembers context across sessions, learns from every interaction, and works with any AI provider.*

[Installation](#installation) -- [Open Source vs Connected](#open-source-vs-connected) -- [Features](#features) -- [Quick Start](#quick-start) -- [Documentation](#documentation)

</div>

---

## Installation

```bash
# Run directly (no install needed)
npx helixmind

# Or install globally
npm install -g helixmind
helixmind
```

### Requirements

- Node.js 18+
- An API key for at least one provider: Anthropic, OpenAI, or Ollama (local, no key needed)

---

## Open Source vs Connected

When you start HelixMind for the first time, you choose how to use it:

```
 +----------------------------------------------------------------------------+
 |  Welcome to HelixMind                                                      |
 |                                                                            |
 |  Login - free, unlock everything        Open Source - no account needed    |
 |                                                                            |
 |    [v] Jarvis AGI                       [v] AI Agent + 22 Tools            |
 |    [v] Validation Matrix                [v] Spiral Memory                  |
 |    [v] Security Monitor                 [v] Anthropic/OpenAI/Ollama        |
 |    [v] Autonomous Mode                  [x] No Jarvis / No Validation      |
 |    [v] 3D Brain Management              [x] No Monitor / No Security       |
 |    [v] 3 Brains + Live WS               [x] No Brain Management            |
 |                                                                            |
 |    No credit card - Free forever - works offline                           |
 +----------------------------------------------------------------------------+
 -> [1] Login / [2] Open Source:
```

| | Open Source | Connected (Free Account) |
|---|---|---|
| AI Agent with 22 Tools | Yes | Yes |
| Spiral Memory (5 levels) | Yes | Yes |
| Anthropic / OpenAI / Ollama | Yes | Yes |
| Checkpoints and Undo | Yes | Yes |
| Bug Journal | Yes | Yes |
| Browser Automation | Yes | Yes |
| Web Knowledge Enrichment | Yes | Yes |
| Swarm (parallel workers) | Yes | Yes |
| MCP Server | Yes | Yes |
| Jarvis AGI | - | Yes |
| Validation Matrix | - | Yes |
| Security Monitor | - | Yes |
| 3D Brain Management | - | Yes |
| Autonomous Mode | - | Yes |
| Web Dashboard Remote Control | - | Yes |

**Both modes are fully functional coding agents.** The open source mode includes everything you need for day-to-day AI-assisted development. Connected mode adds advanced orchestration and monitoring features via a free account at [helix-mind.ai](https://helix-mind.ai).

You can switch anytime by running `helixmind login`.

---

## Features

### 22 Agent Tools

HelixMind operates as an autonomous coding agent with built-in tools:

| Tool | Description |
|:-----|:------------|
| `read_file` / `write_file` / `edit_file` | Read, create, and modify files |
| `list_dir` / `search_files` / `find_files` | Navigate and search the codebase |
| `run_command` | Execute shell commands (sandboxed) |
| `git_status` / `git_commit` / `git_diff` / `git_log` | Full Git integration |
| `spiral_store` / `spiral_query` / `spiral_status` | Interact with spiral memory |
| `web_research` | Search the internet and extract knowledge |
| `bug_report` / `bug_list` | Track and manage bugs |
| `browser_navigate` / `browser_click` / `browser_type` / `browser_screenshot` / `browser_read` / `browser_eval` | Control a headless browser |

All tools go through a 3-tier permission system: **auto** (safe operations), **ask** (confirm first), **dangerous** (requires explicit approval). Use `--yolo` to auto-approve everything.

### Spiral Memory

A 5-level hierarchical memory that persists across sessions:

```
  Level 1 - Focus       Most relevant, recent context
  Level 2 - Active      Related files, dependencies, web knowledge
  Level 3 - Reference   Decisions, patterns, code structure
  Level 4 - Archive     Compressed summaries, old sessions
  Level 5 - Deep        Long-term knowledge, project history
```

Context flows between levels based on relevance, recency, and usage. Web knowledge enrichment automatically fetches and stores relevant information from the internet as you work.

### Swarm Mode

For complex multi-task requests, HelixMind automatically decomposes the work and spawns parallel worker sessions:

```bash
# Auto-detected when you send multi-part requests
> "Create a user model, add CRUD endpoints, and write tests for each"

# Or force it manually
/swarm refactor auth module, update all tests, fix the CI pipeline
```

Each worker gets its own session with file-level locking to prevent conflicts. Results are merged and summarized when all workers complete.

### Checkpoints

Every tool call and chat message creates an automatic checkpoint. Double-tap `ESC` to open the checkpoint browser and revert to any previous state (chat history, code changes, or both).

### Bug Journal

Bugs are automatically detected from your messages (in English and German) and tracked in `.helixmind/bugs.json`. Each bug gets evidence, status, and persists across sessions.

### Browser Automation

Headless Chrome integration via Puppeteer for web testing, scraping, and visual analysis:

```
/browser https://example.com
> "Click the login button and fill in the form"
> "Take a screenshot and analyze the layout"
```

### Multi-Provider Support

| Provider | Models | Setup |
|:---------|:-------|:------|
| Anthropic | Claude Sonnet, Opus, Haiku | `ANTHROPIC_API_KEY=sk-ant-...` |
| OpenAI | GPT-4o, GPT-4, o1, o3 | `OPENAI_API_KEY=sk-...` |
| Ollama | Any local model | No key needed (auto-detected) |

Switch providers at runtime with `/model`.

### MCP Server

HelixMind includes a Model Context Protocol server for integration with other tools:

- Claude Code
- Cursor
- VS Code (Copilot)
- Windsurf
- JetBrains AI

---

## Quick Start

```bash
# Start interactive chat
helixmind

# Initialize in a project (creates .helixmind/)
helixmind init

# Send a single message
helixmind chat -m "fix all lint errors in src/"

# YOLO mode - auto-approve everything
helixmind chat --yolo

# Skip permission prompts
helixmind chat -s

# Feed files into spiral memory
helixmind feed src/ --deep

# Watch files and update spiral live
helixmind feed src/ --watch
```

---

## CLI Commands

| Command | Description |
|:--------|:------------|
| `helixmind` | Start interactive chat (default) |
| `helixmind init` | Initialize HelixMind in project |
| `helixmind chat -m "..."` | Send a single message |
| `helixmind chat --yolo` | Auto-approve all operations |
| `helixmind chat -s` | Skip permission prompts |
| `helixmind feed [paths...]` | Feed files into spiral |
| `helixmind feed --deep` | Deep analysis with intent detection |
| `helixmind feed --watch` | Watch and auto-update spiral |
| `helixmind spiral status` | Show spiral metrics |
| `helixmind spiral search <query>` | Search spiral context |
| `helixmind spiral compact` | Trigger spiral compaction |
| `helixmind config set <k> <v>` | Set config value |
| `helixmind config list` | Show all config |
| `helixmind export [dir]` | Export spiral to .helixmind.zip |
| `helixmind import <zip>` | Import spiral from archive |
| `helixmind login` | Authenticate (switch to Connected mode) |
| `helixmind logout` | Remove stored auth |

### Slash Commands (inside chat)

| Command | Description |
|:--------|:------------|
| `/help` | Show all commands |
| `/model` | Switch AI provider/model |
| `/spiral` | Show spiral status |
| `/brain` | Open 3D brain visualization |
| `/context` | Show assembled context |
| `/tokens` | Token usage stats |
| `/undo` | Undo last file change |
| `/diff` | Show current file changes |
| `/git` | Git operations |
| `/sessions` | Manage background sessions |
| `/browser` | Start browser session |
| `/bugs` | View bug journal |
| `/swarm <msg>` | Force swarm execution |
| `/auto` | Start autonomous mode |
| `/security` | Run security audit |
| `/yolo` | Toggle YOLO mode |
| `/exit` | Quit |

### Keyboard Shortcuts

| Key | Action |
|:----|:-------|
| `ESC ESC` | Emergency stop / checkpoint browser |
| `Ctrl+C` | Exit |
| `Ctrl+L` | Clear screen |
| `Ctrl+PageUp/Down` | Switch session tabs |
| `Tab` | Autocomplete command |

---

## Configuration

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...    # For Claude
OPENAI_API_KEY=sk-...           # For OpenAI/GPT
# Ollama: no key needed (auto-detected on localhost:11434)
```

### Project Config

Create `.helixmind/config.json` in your project root:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514"
}
```

Or use the CLI:

```bash
helixmind config set provider anthropic
helixmind config set model claude-sonnet-4-20250514
```

---

## Tech Stack

| Component | Technology |
|:----------|:-----------|
| Language | TypeScript (strict, ESM) |
| AI Providers | Anthropic SDK, OpenAI SDK, Ollama |
| Database | better-sqlite3 + sqlite-vec (vector search) |
| Embeddings | HuggingFace Transformers (MiniLM-L6-v2) |
| Browser | Puppeteer (headless Chrome) |
| Testing | Vitest (979 tests) |
| MCP | Model Context Protocol SDK |

---

## Development

```bash
git clone https://github.com/DancingTedDanson011/HelixMind.git
cd HelixMind

npm install
npm run build
npm run dev      # Dev mode with watch
npm test         # Run 979 tests
```

---

## License

[AGPL-3.0](LICENSE) -- Free for open-source use. Commercial licenses available.

---

<div align="center">

**[helix-mind.ai](https://helix-mind.ai)**

</div>
