# Changelog

All notable changes to HelixMind will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-XX

### Added
- 🧠 **Spiral Memory Architecture** — 5-level hierarchical context system
  - Focus level: Most relevant, recent context
  - Active level: Related files, dependencies
  - Reference level: Decisions, patterns
  - Archive level: Compressed summaries
  - Deep Archive level: Long-term knowledge
- 🤖 **Multi-Provider Support**
  - Anthropic Claude (Claude 4, Claude 3.5)
  - OpenAI (GPT-4, GPT-4o)
  - Ollama (local models)
- ⚡ **Autonomous Mode**
  - File editing capabilities
  - Command execution
  - Git operations (commit, status, diff)
- 🎯 **Smart Context Assembly**
  - Project structure analysis
  - Dependency tracking
  - Code pattern recognition
- 💾 **Session Management**
  - Session persistence
  - Continue previous sessions
  - Checkpoint system
- 🔧 **CLI Features**
  - Interactive chat mode
  - Command autocomplete
  - Syntax highlighting
  - Progress indicators

### Technical
- TypeScript strict mode
- SQLite + sqlite-vec for vector storage
- Local embeddings via @huggingface/transformers
- Vitest testing framework

---

## Future Roadmap

### [0.2.0] — Planned
- [ ] Web dashboard for memory visualization
- [ ] Multi-session tabs
- [ ] Plugin system
- [ ] Team collaboration features

### [0.3.0] — Planned
- [ ] Cloud sync for spiral memory
- [ ] Custom fine-tuning support
- [ ] IDE integrations (VS Code, JetBrains)

---

[0.1.0]: https://github.com/DancingTedDanson011/HelixMind/releases/tag/v0.1.0
