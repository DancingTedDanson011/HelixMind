# Text Input - Cursor State Machine

## Architektur

Claude Code hat ein **immutable Cursor-State-Objekt** (`z3`), das Text + Cursorposition verwaltet. Jede Operation gibt ein NEUES Objekt zurück.

```
┌─────────────────────────────────┐
│         z3 (CursorState)        │
│  ┌───────────────────────────┐  │
│  │  Av7 (MeasuredText)       │  │
│  │  - Text                   │  │
│  │  - Terminal-Breite        │  │
│  │  - Grapheme Clusters      │  │
│  │  - Word Wrap Positionen   │  │
│  │  - Display-Width Mapping  │  │
│  └───────────────────────────┘  │
│  offset: number (Cursor-Pos)    │
│  selection: number              │
└─────────────────────────────────┘
```

## CursorState Klasse (z3)

```javascript
class CursorState {
  measuredText;   // MeasuredText Instanz
  selection;      // Selektionslänge
  offset;         // Cursor-Position im Text

  constructor(measuredText, offset = 0, selection = 0) {
    // Clamp offset zu gültigem Bereich
    this.offset = Math.max(0, Math.min(this.text.length, offset));
  }

  static fromText(text, columns, offset = 0, selection = 0) {
    return new CursorState(
      new MeasuredText(text, columns - 1),  // -1 für Cursor-Platz
      offset,
      selection
    );
  }

  // ─── Bewegungs-Methoden (alle geben NEUES Objekt zurück) ───

  left()               // Ein Grapheme-Cluster nach links
  right()              // Ein Grapheme-Cluster nach rechts
  up()                 // Eine Wrap-Zeile hoch
  down()               // Eine Wrap-Zeile runter
  startOfLine()        // Anfang der Wrap-Zeile (2x = prev line)
  endOfLine()          // Ende der Wrap-Zeile
  prevWord()           // Vorheriges Wort-Boundary
  nextWord()           // Nächstes Wort-Boundary
  startOfLogicalLine() // Anfang der echten Zeile (vor \n)
  endOfLogicalLine()   // Ende der echten Zeile
  upLogicalLine()      // Eine echte Zeile hoch
  downLogicalLine()    // Eine echte Zeile runter

  // ─── Edit-Methoden (geben NEUES Objekt zurück) ───

  insert(text)         // Text an Cursor einfügen
  backspace()          // Zeichen vor Cursor löschen
  del()                // Zeichen nach Cursor löschen
  deleteWordBefore()   // Wort vor Cursor löschen (Ctrl+W)
  deleteWordAfter()    // Wort nach Cursor löschen (Alt+D)
  deleteToLineEnd()    // Bis Zeilenende löschen (Ctrl+K)
  deleteToLineStart()  // Bis Zeilenanfang löschen (Ctrl+U)
  deleteTokenBefore()  // Smart Delete (Grapheme Clusters)

  // ─── Rendering ───

  render(cursorChar, mask, invert, ghostText)
  // Gibt Array von Wrap-Zeilen mit Cursor-Markierung zurück
}
```

### Warum Immutable?

- **React-freundlich**: Neues Objekt = neuer Render
- **Undo wird trivial**: Einfach vorheriges Objekt wiederherstellen
- **Keine Bugs durch mutierenden State**

## MeasuredText Klasse (Av7)

```javascript
class MeasuredText {
  constructor(text, columns) {
    // Segmentiert Text in Grapheme Clusters
    // (wichtig für Emoji, CJK, kombinierte Zeichen)
    this.segments = new Intl.Segmenter().segment(text);

    // Berechnet Display-Width pro Zeichen
    // CJK = 2 Spalten breit, Emoji = 2, ASCII = 1

    // Berechnet Wrap-Positionen basierend auf Terminal-Breite
  }
}
```

**Intl.Segmenter** ist kritisch! Ohne das:
- `"👨‍👩‍👧‍👦".length` = 11 (JS String Length)
- Aber visuell ist es 1 Zeichen (2 Spalten breit)
- Backspace muss den gesamten Cluster löschen

## Emacs-Style Keybindings

```javascript
// Ctrl-Bindings (im Tw1 Hook):
const ctrlBindings = {
  "a": () => cursor.startOfLine(),        // Zeilenanfang
  "b": () => cursor.left(),               // Links
  "c": () => handleCtrlC(),               // Interrupt
  "d": () => handleDelete(),              // Delete / Exit
  "e": () => cursor.endOfLine(),          // Zeilenende
  "f": () => cursor.right(),             // Rechts
  "h": () => cursor.deleteTokenBefore(),  // Backspace
  "k": () => deleteToLineEnd(),           // Kill bis Ende
  "l": () => clearAll(),                  // Clear
  "n": () => moveDown(),                  // Runter
  "p": () => moveUp(),                    // Hoch
  "u": () => deleteToLineStart(),         // Kill bis Anfang
  "w": () => deleteWordBefore(),          // Kill Wort
  "y": () => yank(),                      // Paste aus Kill Ring
};

// Meta/Alt-Bindings:
const metaBindings = {
  "b": () => cursor.prevWord(),           // Wort links
  "f": () => cursor.nextWord(),           // Wort rechts
  "d": () => cursor.deleteWordAfter(),    // Kill Wort rechts
  "y": () => yankRotate(),                // Kill Ring rotieren
};
```

## Enter / Newline Logik

```javascript
function handleReturn(key) {
  // Backslash + Enter = Newline einfügen
  if (multiline && cursor.offset > 0 && cursor.text[cursor.offset - 1] === "\\") {
    return cursor.backspace().insert("\n");
  }

  // Shift+Enter oder Meta+Enter = Newline einfügen
  if (key.meta || key.shift) {
    return cursor.insert("\n");
  }

  // Plain Enter = Submit
  onSubmit?.(value);
}
```

## Kill Ring (Emacs-style Clipboard)

```javascript
const killRing = [];  // Array von gelöschten Texten
const MAX_ENTRIES = 10;  // oder ähnlich

function kill(text, mode = "append") {
  // Bei aufeinanderfolgenden Kills: Text anhängen
  if (mode === "append") {
    killRing[0] = (killRing[0] || "") + text;
  } else {
    killRing.unshift(text);
  }
  if (killRing.length > MAX_ENTRIES) killRing.pop();
}

function yank() {
  return killRing[0] ?? "";
}

function yankRotate() {
  // Rotiert durch Kill Ring (Alt+Y nach Ctrl+Y)
  const item = killRing.shift();
  killRing.push(item);
  return killRing[0];
}
```

## Für dein Projekt: Minimal CursorState

```javascript
class SimpleCursorState {
  constructor(text, offset = 0) {
    this.text = text;
    this.offset = Math.max(0, Math.min(text.length, offset));
  }

  insert(str) {
    const before = this.text.slice(0, this.offset);
    const after = this.text.slice(this.offset);
    return new SimpleCursorState(before + str + after, this.offset + str.length);
  }

  backspace() {
    if (this.offset === 0) return this;
    const before = this.text.slice(0, this.offset - 1);
    const after = this.text.slice(this.offset);
    return new SimpleCursorState(before + after, this.offset - 1);
  }

  left() {
    return new SimpleCursorState(this.text, this.offset - 1);
  }

  right() {
    return new SimpleCursorState(this.text, this.offset + 1);
  }
}
```
