# Changelog

All notable changes to HelixMind will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.96] - 2026-03

### Performance
- Add embedding LRU cache — eliminates redundant ONNX inference calls
- Batch edge queries in injection engine — 60 SQL queries → 1 per spiral query
- Reuse spiral context for validation — eliminates duplicate spiral query per turn
- Cache systemTokens + skip redundant first trim in agent loop
- Optimize context trimmer from O(N²) to O(N)
- Debounce tool-call spiral stores — N embeddings → 1 batch summary per loop

## [0.1.2] - 2025-06

### Added
- 🔐 **Authentication System**
  - OAuth browser flow with local callback server
  - API key authentication (`--api-key`)
  - Feature gating based on subscription tier
  - `login`, `logout`, `whoami` commands
- 🔬 **Validation Matrix**
  - Static code quality checks (21KB analyzer)
  - Dynamic runtime behavior checks
  - Spiral consistency checks
  - Automatic issue classification and autofix
  - Quality reporting and statistics
- 📊 **SWE-Bench Integration**
  - Built-in benchmark runner with dataset support (Lite/Verified)
  - Task execution harness with parallel support
  - Metrics scoring (pass/fail/partial)
  - Run comparison and history
  - Spiral Memory mode for context-enhanced solving
- 📂 **Feed Pipeline**
  - Feed files/directories into spiral memory
  - Deep analysis and quick overview modes
  - File system watcher for live updates
  - Intent detection and code analysis
- 🌍 **Web Knowledge (Cloud Enrichment)**
  - Topic detection from conversations
  - Web search integration
  - Content extraction from web pages
  - Automatic knowledge integration into spiral
- 🌐 **Web Dashboard** (Next.js 15)
  - 3D brain visualization (Three.js / React Three Fiber)
  - Admin panel with user management, tickets, plans, settings
  - Dashboard with API keys, billing (Stripe), profile editor
  - CLI remote control via WebSocket bridge
  - Support ticket system
  - Blog and documentation (MDX, i18n DE/EN)
  - PWA with service worker and offline support
  - Cookie consent (GDPR)
  - Stripe checkout, portal, and webhooks
- 🧠 **Brain Server**
  - WebSocket server for CLI↔Web communication
  - Relay client for remote connections
  - Control protocol for bidirectional messaging
  - Web-initiated chat handling
  - Brain data archiving and export
  - System prompt template (82KB comprehensive template)
- 🌐 **Browser Automation**
  - Chrome finder for local installation
  - Puppeteer-based browser control
  - Screenshot capture and visual analysis
- 🛡️ **Security Monitor**
  - Continuous security monitoring with three modes (passive/defensive/active)
  - System baseline scanning (processes, ports, configs, packages, users, cron)
  - Real-time threat detection (bruteforce, portscan, malware, config changes)
  - Automated defenses (block IPs, kill processes, close ports, rotate secrets)
  - Web dashboard integration with threat timeline and approval queue
- 🐛 **Bug Tracking**
  - Automatic bug detection in code
  - Bug journal with persistent tracking
- 💾 **Checkpoints**
  - Checkpoint creation and storage
  - Revert to any checkpoint
  - Browser-based checkpoint UI
  - Keyboard shortcuts for quick operations
- 📡 **Sessions**
  - Session lifecycle management
  - Multi-session tab view
- 🎨 **Enhanced UI**
  - Activity feed display
  - Rich status bar and bottom chrome
  - Command autocomplete with suggestions
  - Interactive selection menus
  - Progress indicators
  - Tool output formatting
- ⚡ **Agent Improvements**
  - Permission system (ask/allow/deny per operation)
  - Sandbox execution for safety
  - Undo stack for reversibility
  - Autonomous execution mode
- 🔧 **Provider Enhancements**
  - Per-provider rate limiting
  - Model-specific context window limits
  - Ollama provider for local models
- 📦 **Export/Import**
  - Export spiral to `.helixmind.zip` archive
  - Import from archive (merge or replace)

### Changed
- Context assembly now includes session buffer with trimming
- Spiral engine extended with cloud enrichment
- Chat command expanded with `--yolo`, `-s`, validation flags

## [0.1.0] - 2025-01

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

[0.3.96]: https://github.com/DancingTedDanson011/HelixMind/compare/v0.1.2...v0.3.96
[0.1.2]: https://github.com/DancingTedDanson011/HelixMind/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/DancingTedDanson011/HelixMind/releases/tag/v0.1.0
