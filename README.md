<div align="center">

# 🧠 HelixMind

**AI Coding Assistant with Persistent Spiral Memory**

[![npm version](https://img.shields.io/npm/v/helixmind?color=blue&logo=npm)](https://www.npmjs.com/package/helixmind)
[![License](https://img.shields.io/badge/License-AGPL_3.0-blue?logo=gnu)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18%2B-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)

*Remembers context across sessions. Learns from every interaction.*

[Installation](#-installation) • [Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔄 Spiral Memory
**5-level hierarchical memory** that persists across sessions. Context flows between levels based on relevance and recency.

</td>
<td width="50%">

### 🤖 Multi-Provider
**Claude, GPT-4, Ollama** and more. Switch seamlessly between AI providers.

</td>
</tr>
<tr>
<td width="50%">

### ⚡ Autonomous Mode
AI can **edit files, run commands, and commit changes** — fully autonomous when needed.

</td>
<td width="50%">

### 🎯 Smart Context
**Auto-assembles relevant code** from your project. Understands dependencies and patterns.

</td>
</tr>
</table>

---

## 🚀 Installation

```bash
# Run directly (no install needed)
npx helixmind

# Or install globally
npm install -g helixmind
helixmind
```

---

## 🎮 Quick Start

```bash
# Start interactive chat
npx helixmind

# Initialize in current project
npx helixmind init

# Run autonomous task
npx helixmind "fix all lint errors in src/"

# Continue last session
npx helixmind --continue

# Use specific model
npx helixmind --model claude-sonnet-4-20250514
```

---

## 📋 Commands

| Command | Description |
|:--------|:------------|
| `helixmind` | 🎯 Start interactive chat |
| `helixmind init` | ⚙️ Initialize HelixMind in project |
| `helixmind --continue` | ▶️ Resume last session |
| `helixmind --model <name>` | 🤖 Use specific model |
| `helixmind --help` | ❓ Show all options |

### ⌨️ Keyboard Shortcuts

| Key | Action |
|:----|:-------|
| `Ctrl+C` | 🛑 Exit |
| `Ctrl+L` | 🧹 Clear screen |
| `Ctrl+D` | 🐛 Toggle debug mode |
| `Tab` | ✨ Autocomplete command |

---

## 🧠 Memory Architecture

```
┌─────────────────────────────────────────────────────┐
│  Level 1 — 🔍 Focus                                 │
│  Most relevant, recent context                      │
├─────────────────────────────────────────────────────┤
│  Level 2 — ⚡ Active                                │
│  Related files, dependencies                        │
├─────────────────────────────────────────────────────┤
│  Level 3 — 📚 Reference                             │
│  Decisions, patterns, code structure                │
├─────────────────────────────────────────────────────┤
│  Level 4 — 📦 Archive                               │
│  Compressed summaries, old sessions                 │
├─────────────────────────────────────────────────────┤
│  Level 5 — 🗄️ Deep Archive                          │
│  Long-term knowledge, project history               │
└─────────────────────────────────────────────────────┘
```

Context automatically flows between levels based on relevance and recency.

---

## ⚙️ Configuration

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

### 🔑 Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...    # For Claude
OPENAI_API_KEY=sk-...           # For OpenAI/GPT
```

---

## 🛠️ Tech Stack

| Category | Technology |
|:---------|:-----------|
| Language | ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) |
| AI SDKs | ![Anthropic](https://img.shields.io/badge/Anthropic-SDK-orange) ![OpenAI](https://img.shields.io/badge/OpenAI-SDK-green) |
| Database | ![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-lightgrey) |
| Embeddings | ![Transformers](https://img.shields.io/badge/HuggingFace-Transformers-yellow) |
| Testing | ![Vitest](https://img.shields.io/badge/Vitest-testing-yellowgreen) |

---

## 🏗️ Development

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

---

## 📄 License

[AGPL-3.0](LICENSE) — Free for open-source use. Commercial licenses available.

---

<div align="center">

**Made with ❤️ by [HelixMind](https://github.com/DancingTedDanson011)**

[⬆ Back to Top](#-helixmind)

</div>
