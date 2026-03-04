# Takeaways - Dein Projekt auf Next Level bringen

## Die wichtigsten Patterns aus Claude Code

### 1. Input-Pipeline ist ALLES

Das ist der größte Unterschied zwischen einem "okay" CLI und einem "wow" CLI.

**Was Claude Code macht und du auch brauchst:**

```
Raw stdin → ANSI Tokenizer → Key Parser → Event System → UI
```

**Minimum viable Implementation:**
1. `stdin.setRawMode(true)` → jeden Tastendruck einzeln
2. ANSI State Machine → erkennt Escape-Sequenzen (Pfeiltasten, F-Keys etc.)
3. Bracketed Paste → `\x1b[?2004h` aktivieren, `200~/201~` Marker erkennen
4. Strukturierte Key Events → `{ name, ctrl, meta, shift, isPasted }`

### 2. Immutable State für Text-Input

**Warum Claude Code es so macht:**
- Jede Cursor-Operation gibt ein NEUES Objekt zurück
- Undo = vorheriges Objekt wiederherstellen (trivial!)
- Kein Bug-Potenzial durch geteilten mutablen State
- React-kompatibel (neues Objekt = neuer Render)

**Dein Minimum:**
```javascript
class CursorState {
  constructor(text, offset) { ... }
  insert(str) { return new CursorState(...) }
  backspace() { return new CursorState(...) }
  // Jede Methode → neues Objekt
}
```

### 3. Bracketed Paste ist ein MUSS

Ohne Bracketed Paste ist Multiline-Paste komplett kaputt. Enter wird als "Submit" interpretiert und der Text wird Zeile für Zeile ausgeführt.

```javascript
// Aktivieren:
stdout.write("\x1b[?2004h");

// Erkennen:
if (data.includes("\x1b[200~")) {
  // PASTE MODUS - alles sammeln bis \x1b[201~
}
```

### 4. Double-Buffer Rendering

**Das Problem:** Wenn du bei jedem Render den ganzen Screen löschst und neu zeichnest, flackert es.

**Die Lösung:**
1. Vorherigen Frame merken
2. Neuen Frame berechnen
3. Nur GEÄNDERTE Zeilen neu schreiben
4. Alles in EINEM `stdout.write()` senden

### 5. FileHistory für Rewind

**Das Killer-Feature:** Vor jeder Dateiänderung ein Backup machen, gruppiert nach AI-Messages. Dann kann der User zu jedem Punkt zurückspulen.

```
Message 1 → Snapshot (Backup aller betroffenen Dateien)
Message 2 → Snapshot
Message 3 → Snapshot ← /rewind hierhin
Message 4 → wird verworfen
```

### 6. Kill Ring statt einfachem Clipboard

Emacs-Style: Ctrl+K, Ctrl+U, Ctrl+W speichern gelöschten Text. Ctrl+Y fügt ihn ein. Alt+Y rotiert durch vorherige Kills.

### 7. Context-Aware Keybindings

Nicht alle Bindings sind immer aktiv. "Enter" bedeutet verschiedene Dinge je nach Kontext (Chat → Submit, Autocomplete → Accept, Confirm → Yes).

---

## Empfohlene Reihenfolge für dein Projekt

### Phase 1: Fundament (Input + Rendering)
- [ ] Raw Mode + ANSI Tokenizer
- [ ] Key Event System
- [ ] Bracketed Paste
- [ ] Einfaches zeilenbasiertes Rendering (kein Flackern)

### Phase 2: Text-Editing
- [ ] Immutable CursorState
- [ ] Emacs-Keybindings (Ctrl+A/E/K/U/W/Y)
- [ ] Multiline Input (Shift+Enter)
- [ ] Kill Ring

### Phase 3: UX Features
- [ ] Prompt History (JSONL + Up/Down Navigation)
- [ ] Ctrl+R History Search
- [ ] Tab Completion (compgen-basiert)
- [ ] Input Undo (Ctrl+_)

### Phase 4: Power Features
- [ ] FileHistory / Rewind System
- [ ] Context-Aware Keybindings
- [ ] Spinner mit Shimmer-Animation
- [ ] Theme System mit TrueColor Detection
- [ ] Stash (Ctrl+S)

---

## Tech-Entscheidungen

| Frage | Claude Code | Empfehlung für dich |
|---|---|---|
| UI Framework | Ink (React für Terminal) | Ink wenn React-erfahren, sonst raw ANSI |
| Layout | Yoga (Flexbox) | Für einfache UIs: manuelles Rendering |
| Rendering | Double-Buffer | JA, unbedingt |
| Input Parsing | Custom ANSI State Machine | JA, kein readline |
| History | JSONL File + File Locking | JSONL reicht |
| Syntax Highlighting | highlight.js gebundelt | highlight.js oder Shiki |

## Referenz-Bibliotheken

Falls du nicht alles selbst bauen willst:

| Feature | Bibliothek |
|---|---|
| Terminal UI Framework | [ink](https://github.com/vadimdemedes/ink) |
| Key Event Parsing | [keypress](https://www.npmjs.com/package/keypress) oder selbst |
| ANSI Escape Codes | [ansi-escapes](https://www.npmjs.com/package/ansi-escapes) |
| Text-Breite (CJK/Emoji) | [string-width](https://www.npmjs.com/package/string-width) |
| Word Wrap | [wrap-ansi](https://www.npmjs.com/package/wrap-ansi) |
| Syntax Highlighting | [highlight.js](https://highlightjs.org/) |
| Spinner | [ora](https://www.npmjs.com/package/ora) |
| Farben | [chalk](https://www.npmjs.com/package/chalk) |
| Tab Completion | [@withfig/autocomplete](https://fig.io/) |
| Grapheme Clusters | `Intl.Segmenter` (built-in ab Node 16) |

## Key Insight

> Claude Code ist im Kern eine **React-Applikation die im Terminal läuft**.
> Sie nutzt denselben Component-Tree, State-Management und Reconciler-Ansatz
> wie eine Web-App, aber mit einem Custom Renderer der ANSI statt DOM erzeugt.
>
> Der entscheidende Unterschied zu "normalen" CLI-Tools:
> **Sie behandelt das Terminal wie einen Canvas**, nicht wie eine Pipe.
