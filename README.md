# HelixMind CLI

> AI Coding Assistant with Persistent Spiral Memory

An intelligent CLI coding assistant that remembers context across sessions using a 5-level spiral memory architecture.

## Installation

```bash
# Run directly (no install needed)
npx helixmind

# Or install globally
npm install -g helixmind
helixmind
```

## Quick Start

```bash
# Start interactive chat
npx helixmind

# Initialize in current project
npx helixmind init

# Run autonomous task
npx helixmind "fix all lint errors"

# Continue last session
npx helixmind --continue
```

## Features

- **Spiral Memory**: 5-level hierarchical context that persists across sessions
- **Multi-Provider**: Supports Claude, OpenAI, Ollama, and more
- **Autonomous Mode**: AI can make edits, run commands, and commit changes
- **Session Management**: Tabs, checkpoints, and rollback support
- **Smart Context**: Auto-assembles relevant code context from your project

## Commands

| Command | Description |
|---------|-------------|
| `helixmind` | Start interactive chat |
| `helixmind init` | Initialize HelixMind in project |
| `helixmind --continue` | Resume last session |
| `helixmind --model <name>` | Use specific model |
| `helixmind --help` | Show all options |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+C` | Exit |
| `Ctrl+L` | Clear screen |
| `Ctrl+D` | Toggle debug mode |
| `Tab` | Autocomplete command |

## Configuration

Create `.helixmind/config.json` in your project:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "brainEnabled": true,
  "permissions": {
    "writeFiles": true,
    "runCommands": true,
    "gitCommit": true
  }
}
```

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...    # For Claude
OPENAI_API_KEY=sk-...           # For OpenAI/GPT
```

## Memory Architecture

HelixMind uses a 5-level spiral memory:

```
Level 1 (Focus)     → Most relevant, recent context
Level 2 (Active)    → Related files, dependencies
Level 3 (Reference) → Decisions, patterns
Level 4 (Archive)   → Compressed summaries
Level 5 (Deep)      → Long-term knowledge
```

Context automatically flows between levels based on relevance and recency.

## Development

```bash
# Clone repo
git clone https://github.com/DancingTedDanson011/HelixMind.git
cd HelixMind

# Install dependencies
npm install

# Build
npm run build

# Run in dev mode
npm run dev

# Run tests
npm test
```

## Tech Stack

- TypeScript (strict mode)
- Anthropic SDK / OpenAI SDK
- better-sqlite3 + sqlite-vec
- @huggingface/transformers (local embeddings)
- Vitest

## License

AGPL-3.0 — see [LICENSE](LICENSE)
