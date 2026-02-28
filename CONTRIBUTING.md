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

### Getting Started

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
```

---

## Project Structure

```
helixmind/
├── src/
│   ├── cli/              # CLI implementation
│   │   ├── commands/     # Command handlers
│   │   ├── ui/           # Terminal UI components
│   │   ├── agent/        # Autonomous agent logic
│   │   ├── providers/    # AI provider implementations
│   │   └── brain/        # Spiral memory system
│   ├── utils/            # Shared utilities
│   └── types.ts          # TypeScript definitions
├── tests/                # Test files
├── docs/                 # Documentation
└── scripts/              # Build and setup scripts
```

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
feat(memory): add checkpoint rollback
fix(cli): resolve autocomplete on Windows
docs(readme): update installation instructions
```

---

## Development Guidelines

### Code Style

- **TypeScript strict mode** — No `any` types
- **ES modules** — Use `import/export` syntax
- **Clear naming** — Descriptive variable and function names
- **Comments** — Only when "why" isn't obvious

### Testing

- Write tests for new features
- Maintain or improve coverage
- Test edge cases and error paths

---

## Need Help?

- Open a [Discussion](https://github.com/DancingTedDanson011/HelixMind/discussions)
- Check [Issues](https://github.com/DancingTedDanson011/HelixMind/issues)
- Review the [Documentation](./docs/)

---

Thank you for contributing! 🙏
