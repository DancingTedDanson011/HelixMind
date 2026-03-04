# Contributing to HelixMind

Thank you for your interest in contributing to HelixMind!

This repository contains the **open source CLI agent**. The web dashboard, connected features (Jarvis, Validation Matrix, Security Monitor, etc.), and premium components live in a separate private repository.

---

## What You Can Contribute

- **Bug fixes** -- found a crash or wrong behavior? Fix it!
- **New agent tools** -- extend the 22-tool toolkit
- **Spiral memory improvements** -- better embeddings, smarter decay, new compression strategies
- **Provider support** -- add new LLM providers (Google, Mistral, etc.)
- **Browser automation** -- improve headless Chrome integration
- **Performance** -- faster startup, lower memory, better SQLite queries
- **Tests** -- increase coverage, add edge cases
- **Documentation** -- improve README, add examples, fix typos
- **Platform support** -- better Windows/macOS/Linux compatibility

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Git
- (Optional) Ollama for local model testing

### Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/HelixMind.git
cd HelixMind

# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Run tests
npm test
```

### Running the CLI locally

```bash
# After build, run directly
node dist/cli/index.js

# Or link globally
npm link
helixmind
```

---

## Project Structure

```
src/
  cli/
    commands/       Chat loop, config, spiral, feed commands
    agent/          Agent loop, permissions, sandbox, undo, tools
    brain/          Brain server, relay, 3D visualization template
    browser/        Puppeteer browser automation + vision
    bugs/           Automatic bug detection and journal
    checkpoints/    Checkpoint store, revert, keybinding
    context/        System prompt assembly, project analysis
    feed/           File feed pipeline (analyzer, parser, watcher)
    providers/      AI providers (Anthropic, OpenAI, Ollama)
    sessions/       Session management, multi-tab view
    ui/             Terminal UI (statusbar, progress, menus)
    validation/     Output validation matrix
  spiral/
    engine.ts       Core spiral memory (5-level architecture)
    cloud/          Web knowledge enrichment
  storage/          SQLite + sqlite-vec database layer
  tools/            MCP tool definitions
  utils/            Shared utilities
tests/              Test files mirroring src/ structure
```

---

## Pull Request Process

1. **Fork** the repo and create a branch from `master`
2. **Code** your changes
3. **Test** -- make sure `npm test` passes
4. **Type check** -- run `npx tsc --noEmit`
5. **Submit** a PR with a clear description of what and why

### Commit Messages

Use conventional commits:

```
type(scope): short description

feat(agent): add new search tool
fix(cli): resolve Windows path handling
docs(readme): update installation section
test(spiral): add compression edge cases
refactor(providers): simplify streaming logic
```

**Scopes:** cli, agent, spiral, storage, providers, browser, bugs, checkpoints, context, feed, sessions, ui, validation, tools

---

## Code Style

- TypeScript strict mode, ESM
- No `any` types
- Descriptive variable names
- Comments only when "why" isn't obvious
- Lazy imports with `await import()` for fast startup
- Keep it simple -- YAGNI

---

## What's NOT in This Repo

The following features are part of the connected/commercial version and are not included here:

- Jarvis Task Daemon
- Validation Matrix
- Security Monitor
- 3D Brain Management
- Autonomous Mode
- Web Dashboard

See the [README](README.md) for the full comparison between open source and connected modes.

---

## Reporting Issues

When filing an issue, please include:

- **OS and version** (Windows/macOS/Linux)
- **Node.js version** (`node --version`)
- **HelixMind version** (`helixmind --version`)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Error output** (if any)

---

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).

---

## Questions?

- Open a [Discussion](https://github.com/DancingTedDanson011/HelixMind/discussions)
- Check [Issues](https://github.com/DancingTedDanson011/HelixMind/issues)
