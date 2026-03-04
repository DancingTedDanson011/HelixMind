# Claude Code CLI - Architektur-Analyse

> Reverse-Engineering der Claude Code CLI v2.1.68
> Pfad: `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\cli.js`
> ~12 MB, ~12.829 Zeilen (minifiziert, gebundelt)

## Tech-Stack

| Komponente | Technologie |
|---|---|
| UI Framework | **Ink** (Custom Fork) - React für Terminal |
| Layout Engine | **Yoga** (Facebook Flexbox) |
| React Reconciler | Custom `createContainer` / `updateContainerSync` |
| Rendering | Double-Buffered Frame System |
| Input | Custom ANSI State-Machine Parser |
| Syntax Highlighting | highlight.js (gebundelt) |
| Code Parsing | tree-sitter (WASM) |
| SVG Rendering | resvg (WASM) |
| Bildverarbeitung | sharp (native, plattformspezifisch) |
| Codesuche | ripgrep (vendored, native binary) |

## Dateien im Projekt

```
@anthropic-ai/claude-code/
├── cli.js              (12 MB) - ALLES gebundelt in einer Datei
├── package.json
├── tree-sitter.wasm    (205 KB)
├── tree-sitter-bash.wasm (1.4 MB)
├── resvg.wasm          (2.5 MB)
├── node_modules/@img/sharp-win32-x64/
└── vendor/ripgrep/     (plattformspezifische Binaries)
```

## Dokumentation

| Datei | Inhalt |
|---|---|
| [01-INPUT-SYSTEM.md](01-INPUT-SYSTEM.md) | Input Pipeline, Key Events, Raw Mode |
| [02-PASTE-HANDLING.md](02-PASTE-HANDLING.md) | Bracketed Paste, Image Paste |
| [03-TEXT-INPUT.md](03-TEXT-INPUT.md) | Cursor State Machine, Emacs-Keybindings |
| [04-RENDERING.md](04-RENDERING.md) | Double-Buffer, Yoga Layout, Ink Components |
| [05-UNDO-REWIND.md](05-UNDO-REWIND.md) | Undo-System, FileHistory, Snapshots |
| [06-KEYBINDINGS.md](06-KEYBINDINGS.md) | Context-aware Keybinding System |
| [07-SPINNER-ANIMATION.md](07-SPINNER-ANIMATION.md) | Shimmer, Stall Detection |
| [08-HISTORY-AUTOCOMPLETE.md](08-HISTORY-AUTOCOMPLETE.md) | Prompt History, Tab Completion |
| [09-THEMING.md](09-THEMING.md) | Farbsystem, ANSI Fallbacks |
| [10-TAKEAWAYS.md](10-TAKEAWAYS.md) | Konkrete Empfehlungen für dein Projekt |
