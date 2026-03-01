<div align="center">

# HelixMind

**AI Coding Assistant with Persistent Spiral Memory**

[![npm version](https://img.shields.io/npm/v/helixmind?color=blue&logo=npm)](https://www.npmjs.com/package/helixmind)
[![License](https://img.shields.io/badge/License-AGPL_3.0-blue?logo=gnu)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18%2B-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)

*Remembers context across sessions. Learns from every interaction. Full SaaS platform with CLI + Web Dashboard.*

[Installation](#installation) &bull; [Features](#features) &bull; [Quick Start](#quick-start) &bull; [Web Platform](#web-platform) &bull; [Documentation](#documentation)

</div>

---

## Features

<table>
<tr>
<td width="50%">

### Spiral Memory
**5-level hierarchical memory** that persists across sessions. Context flows between levels based on relevance and recency.

</td>
<td width="50%">

### Multi-Provider
**Claude, GPT-4, Ollama** and more. Switch seamlessly between AI providers with rate limiting and model limits.

</td>
</tr>
<tr>
<td width="50%">

### Autonomous Agent
AI can **edit files, run commands, commit changes, and browse the web** with a permission system and sandbox for safety.

</td>
<td width="50%">

### Smart Context
**Auto-assembles relevant code** from your project. Session buffer, context trimming, and dependency tracking.

</td>
</tr>
<tr>
<td width="50%">

### Web Dashboard
**Next.js 15 platform** with 3D brain visualization, admin panel, billing (Stripe), support tickets, and CLI remote control.

</td>
<td width="50%">

### Validation Matrix
**Automatic output validation** with static checks, dynamic checks, spiral checks, autofix, and quality classification.

</td>
</tr>
<tr>
<td width="50%">

### SWE-Bench Integration
**Built-in benchmark suite** &mdash; run SWE-bench Lite/Verified, compare runs, measure Spiral Memory impact.

</td>
<td width="50%">

### Web Knowledge
**Cloud-enriched context** &mdash; topic detection, web search, content extraction, and automatic knowledge integration.

</td>
</tr>
<tr>
<td width="50%">

### Bug Tracking
**Automatic bug detection** and persistent journal &mdash; track bugs across sessions with evidence and status.

</td>
<td width="50%">

### Checkpoints & Sessions
**Save and revert** to any checkpoint, multi-session tab view, session lifecycle management.

</td>
</tr>
<tr>
<td width="50%">

### Browser Automation
**Puppeteer-based browser control** &mdash; navigate, click, type, screenshot, visual analysis with Chrome integration.

</td>
<td width="50%">

### Authentication & Security
**OAuth login, API keys, feature gating** &mdash; secure access control with subscription tier enforcement.

</td>
</tr>
<tr>
<td width="50%">

### Security Monitor
**Continuous security monitoring** &mdash; threat detection, automated defenses, real-time dashboard with approval queue.

</td>
<td width="50%">

### MCP Integration
**Model Context Protocol** &mdash; works with Claude Code, Cursor, VS Code, Windsurf, Codex, JetBrains AI.

</td>
</tr>
</table>

---

## Brain Visualization

<div align="center">

https://github.com/user-attachments/assets/brain_3d_vision.mp4

[![Watch the 3D Brain in action](https://img.shields.io/badge/Watch-3D_Brain_Demo-blue?style=for-the-badge&logo=youtube)](assets/brain_3d_vision.mp4)

*Interactive 3D brain visualization showing memory layers and connections*

</div>

> **Note:** If the video above does not play, [download it directly](assets/brain_3d_vision.mp4) or clone the repository to view it locally.

---

## Installation

```bash
# Run directly (no install needed)
npx helixmind

# Or install globally
npm install -g helixmind
helixmind
```

---

## Quick Start

```bash
# Start interactive chat (default command)
npx helixmind

# Initialize in current project
npx helixmind init

# Send a single message
npx helixmind chat -m "fix all lint errors in src/"

# YOLO mode - auto-approve everything
npx helixmind chat --yolo

# Skip permission prompts
npx helixmind chat -s

# Feed files into spiral memory
npx helixmind feed src/ --deep

# Watch files and update spiral live
npx helixmind feed src/ --watch
```

---

## CLI Commands

| Command | Description |
|:--------|:------------|
| `helixmind` / `helixmind chat` | Start interactive chat (default) |
| `helixmind helix` | Alias for interactive chat |
| `helixmind init` | Initialize HelixMind in project |
| `helixmind chat -m "..."` | Send a single message |
| `helixmind chat --yolo` | Auto-approve all operations |
| `helixmind chat --no-validation` | Disable output validation |
| `helixmind chat --validation-verbose` | Detailed validation output |
| `helixmind chat --validation-strict` | Treat validation warnings as errors |
| `helixmind feed [paths...]` | Feed files/dirs into spiral |
| `helixmind feed --deep` | Deep analysis with intent detection |
| `helixmind feed --watch` | Watch and auto-update spiral |
| `helixmind spiral status` | Show spiral metrics |
| `helixmind spiral search <query>` | Search spiral context |
| `helixmind spiral compact` | Trigger spiral compaction |
| `helixmind config set <k> <v>` | Set config value |
| `helixmind config get <key>` | Get config value |
| `helixmind config list` | Show all config |
| `helixmind export [dir]` | Export spiral to .helixmind.zip |
| `helixmind import <zip>` | Import spiral from archive |
| `helixmind login` | Authenticate with web platform |
| `helixmind logout` | Remove stored auth |
| `helixmind whoami` | Show auth status |
| `helixmind bench run` | Run SWE-bench benchmark |
| `helixmind bench results` | Show benchmark results |
| `helixmind bench compare` | Compare benchmark runs |
| `helixmind bench list` | List past runs |

### Keyboard Shortcuts

| Key | Action |
|:----|:-------|
| `ESC ESC` | Emergency stop (abort all sessions) |
| `Ctrl+C` | Exit |
| `Ctrl+L` | Clear screen |
| `Ctrl+D` | Toggle debug mode |
| `Ctrl+PageUp/Down` | Switch session tabs |
| `Tab` | Autocomplete command |

---

## Memory Architecture

```
+-----------------------------------------------------+
|  Level 1 - Focus                                    |
|  Most relevant, recent context                      |
+-----------------------------------------------------+
|  Level 2 - Active                                   |
|  Related files, dependencies                        |
+-----------------------------------------------------+
|  Level 3 - Reference                                |
|  Decisions, patterns, code structure                |
+-----------------------------------------------------+
|  Level 4 - Archive                                  |
|  Compressed summaries, old sessions                 |
+-----------------------------------------------------+
|  Level 5 - Deep Archive                             |
|  Long-term knowledge, project history               |
+-----------------------------------------------------+
```

Context automatically flows between levels based on relevance and recency. Cloud enrichment adds web knowledge via topic detection and content extraction.

---

## Web Platform

The web dashboard (available at [helix-mind.ai](https://helix-mind.ai)) is a separate **Next.js 15** application:

| Feature | Description |
|:--------|:------------|
| **3D Brain View** | Interactive Three.js visualization of your spiral memory |
| **Dashboard** | Manage API keys, billing, profile, and CLI connections |
| **Admin Panel** | User management, ticket system, plans, settings, stats |
| **CLI Integration** | WebSocket bridge &mdash; control your CLI from the browser |
| **Support System** | Built-in ticket system with detail views |
| **Blog & Docs** | MDX-based with i18n (DE/EN), sidebar navigation |
| **Auth** | NextAuth with OAuth, staff login, CLI authorization |
| **Billing** | Stripe checkout, portal, webhooks |
| **PWA** | Service worker, install prompt, offline support |
| **Cookie Consent** | GDPR-compliant cookie banner and settings |

---

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

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...    # For Claude
OPENAI_API_KEY=sk-...           # For OpenAI/GPT
# Ollama: no key needed (local)
```

---

## Tech Stack

### CLI

| Category | Technology |
|:---------|:-----------|
| Language | ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) |
| AI SDKs | ![Anthropic](https://img.shields.io/badge/Anthropic-SDK-orange) ![OpenAI](https://img.shields.io/badge/OpenAI-SDK-green) ![Ollama](https://img.shields.io/badge/Ollama-local-purple) |
| Database | ![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-lightgrey) ![sqlite-vec](https://img.shields.io/badge/sqlite--vec-vectors-blue) |
| Embeddings | ![Transformers](https://img.shields.io/badge/HuggingFace-Transformers-yellow) |
| Browser | ![Puppeteer](https://img.shields.io/badge/Puppeteer-headless-green) |
| Testing | ![Vitest](https://img.shields.io/badge/Vitest-70%2B_tests-yellowgreen) |
| MCP | ![MCP](https://img.shields.io/badge/MCP-SDK-blue) |

### Web

| Category | Technology |
|:---------|:-----------|
| Framework | ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![React](https://img.shields.io/badge/React-19-blue) |
| 3D | ![Three.js](https://img.shields.io/badge/Three.js-R3F-green) |
| Database | ![Prisma](https://img.shields.io/badge/Prisma-6-purple) |
| Auth | ![NextAuth](https://img.shields.io/badge/NextAuth-v5-orange) |
| Payments | ![Stripe](https://img.shields.io/badge/Stripe-17-blue) |
| Styling | ![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan) |
| i18n | ![next-intl](https://img.shields.io/badge/next--intl-DE%2FEN-yellow) |
| PWA | ![Serwist](https://img.shields.io/badge/Serwist-PWA-green) |

---

## Development

```bash
# Clone repo
git clone https://github.com/DancingTedDanson011/HelixMind.git
cd HelixMind

# Install dependencies (CLI)
npm install

# Build CLI
npm run build

# Run CLI in dev mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Web dashboard
cd web
npm install
npm run dev
```

---

## Documentation

Complete documentation is available in the web dashboard and includes:

| Category | Topics |
|:---------|:-------|
| **Core Concepts** | Spiral Memory, Validation Matrix, Web Knowledge, Bug Tracking, Browser Automation |
| **Usage Guides** | Getting Started, Configuration, Authentication, Project Setup |
| **Advanced** | Autonomous Modes, Agent Tools, MCP Integration, SWE-Bench |
| **Reference** | CLI Commands, Slash Commands, Permission System, Export/Import |

**Web Dashboard Docs**: Start the web dashboard (`cd web && npm run dev`) and navigate to `/docs`.

**CLI Help**: Use `helixmind --help` or `helixmind chat --help` for command reference.

---

## License

[AGPL-3.0](LICENSE) &mdash; Free for open-source use. Commercial licenses available.

---

<div align="center">

**Made with care by [HelixMind](https://helix-mind.ai)**

[Back to Top](#helixmind)

</div>
