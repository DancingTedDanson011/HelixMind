# Contributing to HelixMind

First off, thank you for considering contributing to HelixMind! 🎉

## Quick Links

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code.

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git
- (Optional) PostgreSQL for web dashboard
- (Optional) Ollama for local model testing

### Getting Started — CLI

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/HelixMind.git
cd HelixMind

# Install dependencies
npm install

# Build the project
npm run build

# Run in development
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Getting Started — Web Dashboard

```bash
cd web

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your database URL, auth secrets, Stripe keys, etc.

# Set up database
npx prisma db push
npm run db:seed

# Start dev server (Turbopack)
npm run dev
```

---

## Project Structure

```
helixmind/
├── src/
│   ├── cli/                   # CLI application
│   │   ├── commands/          # Command handlers (chat, config, spiral, feed, bench, auth, ...)
│   │   ├── agent/             # Autonomous agent (loop, permissions, sandbox, undo)
│   │   ├── auth/              # Authentication (OAuth, feature-gate, guard)
│   │   ├── bench/             # SWE-bench benchmark suite
│   │   ├── brain/             # Brain server, relay, template, control protocol
│   │   ├── browser/           # Puppeteer browser automation + vision
│   │   ├── bugs/              # Bug detection and journal
│   │   ├── checkpoints/       # Checkpoint store, revert, keybinding
│   │   ├── context/           # Context assembly, session buffer, trimming
│   │   ├── feed/              # Feed pipeline (analyzer, parser, scanner, watcher)
│   │   ├── providers/         # AI providers (Anthropic, OpenAI, Ollama, rate-limiter)
│   │   ├── sessions/          # Session management, tab view
│   │   ├── ui/                # Terminal UI (activity, statusbar, progress, menus)
│   │   ├── validation/        # Output validation matrix (static, dynamic, spiral checks)
│   │   └── config/            # Config persistence
│   ├── spiral/                # Core spiral memory engine
│   │   ├── cloud/             # Web knowledge enrichment
│   │   └── ...                # Engine, compression, embeddings, injection, relevance
│   ├── storage/               # SQLite + sqlite-vec storage layer
│   ├── tools/                 # MCP tool definitions
│   └── utils/                 # Shared utilities
├── web/                       # Next.js 15 web platform
│   ├── src/
│   │   ├── app/               # App router (pages + API routes)
│   │   ├── components/        # ~100 React components
│   │   ├── hooks/             # React hooks (CLI connection, chat)
│   │   ├── lib/               # Shared utilities
│   │   └── i18n/              # Internationalization
│   ├── content/               # Blog + docs (MDX, DE/EN)
│   ├── prisma/                # Database schema + seed
│   └── messages/              # Translation files
├── tests/                     # 70+ test files mirroring src/ structure
├── scripts/                   # Build and setup scripts
└── .github/                   # Issue templates, PR template, workflows
```

---

## Key Modules

| Module | What it does |
|:-------|:------------|
| `cli/commands/chat.ts` | Main chat loop (120KB) — the heart of the CLI |
| `cli/brain/template.ts` | System prompt template (82KB) — defines AI personality and capabilities |
| `cli/agent/loop.ts` | Agent tool-use loop — executes tools, manages permissions |
| `cli/validation/` | Output quality validation with autofix (static, dynamic, spiral checks) |
| `cli/bugs/` | Automatic bug detection and persistent journal |
| `cli/browser/` | Puppeteer browser automation + visual analysis |
| `cli/checkpoints/` | Checkpoint store, revert, browser UI |
| `cli/feed/` | File feed pipeline with analyzer, parser, watcher |
| `cli/auth/` | OAuth login, feature gating, guard system |
| `cli/bench/` | SWE-bench benchmark runner and harness |
| `cli/sessions/` | Session lifecycle and multi-tab view |
| `cli/context/` | Context assembly, project analysis, trimming |
| `cli/providers/` | AI providers (Anthropic, OpenAI, Ollama) with rate limiting |
| `cli/agent/monitor/` | Security monitoring system with scanner, watcher, alerter, defenses |
| `spiral/engine.ts` | Core spiral memory with 5-level architecture |
| `spiral/cloud/` | Web knowledge enrichment (search, topic detection, extraction) |
| `storage/` | SQLite + sqlite-vec database layer |
| `web/server.ts` | Custom Next.js server with WebSocket relay |

---

## Pull Request Process

1. **Fork & Branch** — Create a feature branch from `main`
2. **Code** — Make your changes with clear, descriptive commits
3. **Test** — Ensure all tests pass (`npm test`)
4. **Lint** — Run type checking (`npm run lint`)
5. **Document** — Update docs if needed
6. **Submit** — Open a PR with a clear description

### Commit Message Format

```
type(scope): description

# Examples:
feat(agent): add browser automation tool
feat(web): add admin user detail view
fix(cli): resolve autocomplete on Windows
fix(validation): false positive on empty files
docs(readme): update architecture section
test(bench): add harness edge case tests
```

### Scopes

CLI: `cli`, `agent`, `auth`, `bench`, `brain`, `browser`, `bugs`, `checkpoints`, `context`, `feed`, `providers`, `sessions`, `ui`, `validation`

Core: `spiral`, `storage`, `tools`, `config`

Web: `web`, `admin`, `dashboard`, `docs`, `landing`, `api`

---

## Development Guidelines

### Code Style

- **TypeScript strict mode** — No `any` types
- **ES modules** — Use `import/export` syntax
- **Clear naming** — Descriptive variable and function names
- **Comments** — Only when "why" isn't obvious
- **Lazy imports** — Commands use `await import()` for fast startup

### Testing

- Write tests for new features
- Maintain or improve coverage
- Test edge cases and error paths
- Tests mirror `src/` structure in `tests/`
- Run with: `npm test` (Vitest)

### Web Development

- **Tailwind CSS 4** for styling
- **next-intl** for i18n — always add both DE and EN translations
- **Prisma** for database — run `npx prisma db push` after schema changes
- **Components** follow the folder structure in `src/components/`

---

## Need Help?

- Open a [Discussion](https://github.com/DancingTedDanson011/HelixMind/discussions)
- Check [Issues](https://github.com/DancingTedDanson011/HelixMind/issues)
- Review the [CLI Architecture](./CLI-ARCHITECTURE.md)

---

Thank you for contributing! 🙏
