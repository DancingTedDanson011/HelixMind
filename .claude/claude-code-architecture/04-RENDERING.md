# Rendering - Double-Buffered Frame System

## Architektur

```
React Component Tree
  │
  ▼
Yoga Layout (Flexbox-Berechnung)
  │
  ▼
Y98 Renderer (React Tree → Frame Buffer)
  │
  ▼
Double-Buffer Diff (neuer Frame vs. alter Frame)
  │
  ▼
l98 Output (minimale ANSI-Befehle → stdout)
```

## Ink Framework (Custom Fork)

Claude Code nutzt einen **stark angepassten Fork von Ink** (React für Terminal, von Vadim Demedes).

### Exportierte Komponenten und Hooks

```javascript
// Komponenten:
Box         // Flexbox Container (wie <div>)
Text        // Text-Element (wie <span>)
BaseBox     // Low-level Box
BaseText    // Low-level Text
Spacer      // Flexibler Spacer
Newline     // Zeilenumbruch
Link        // Hyperlink (OSC 8)
Ansi        // Raw ANSI-Output

// Hooks:
useInput()           // Keyboard Input
useStdin()           // Raw Stdin Zugriff
useFocus()           // Focus Management
useFocusManager()    // Focus Navigation
useApp()             // App-Lifecycle
useAnimationFrame()  // Animation Loop
useAnimationTimer()  // Timer-basierte Animation
useInterval()        // setInterval Wrapper
useTerminalTitle()   // Terminal-Titel setzen
useTerminalFocus()   // Terminal Focus Events

// Rendering:
render()             // React Tree rendern
createRoot()         // Root erstellen
measureElement()     // Element vermessen
```

### Yoga Layout Engine

```javascript
// Yoga-Wrapper Klasse (x58)
class YogaNode {
  // Standard Flexbox Properties:
  setFlexDirection(direction)    // row | column | row-reverse | column-reverse
  setAlignItems(alignment)      // flex-start | center | flex-end | stretch
  setJustifyContent(justify)    // flex-start | center | flex-end | space-between
  setWidth(width)               // absolute oder prozentual
  setHeight(height)
  setPadding(edge, value)
  setMargin(edge, value)
  setBorder(edge, value)
  setFlexGrow(value)
  setFlexShrink(value)
  setFlexBasis(value)
  setOverflow(overflow)         // hidden | visible | scroll
  setDisplay(display)           // flex | none
}
```

## Double-Buffer System

```javascript
class InkInstance {
  frontFrame;    // Aktuell angezeigter Frame
  backFrame;     // Vorheriger Frame (für Diff)
  stylePool;     // Wiederverwendbare Style-Objekte
  charPool;      // Wiederverwendbare Char-Objekte
  hyperlinkPool; // Wiederverwendbare Hyperlink-Objekte

  onRender() {
    // 1. Yoga Layout berechnen
    rootNode.calculateLayout(terminalWidth, terminalHeight);

    // 2. React Tree in Frame rendern
    const newFrame = renderToFrame(componentTree);

    // 3. Diff gegen vorherigen Frame
    const commands = diffFrames(this.backFrame, newFrame);

    // 4. Nur geänderte Bereiche an Terminal senden
    executeCommands(commands);

    // 5. Frames tauschen
    this.backFrame = this.frontFrame;
    this.frontFrame = newFrame;
  }
}
```

### Warum Double-Buffer?

- **Performance**: Nur geänderte Zeichen werden neu geschrieben
- **Kein Flackern**: Kein Clear + Redraw des gesamten Screens
- **Object Pools**: Weniger GC-Druck durch wiederverwendete Objekte

## Output Commands

```javascript
function executeCommands(terminal, commands) {
  let output = "";

  for (const cmd of commands) {
    switch (cmd.type) {
      case "stdout":
        output += cmd.content;
        break;
      case "clear":
        output += clearLines(cmd.count);
        break;
      case "clearTerminal":
        output += "\x1b[2J\x1b[H";  // Clear Screen + Home
        break;
      case "cursorHide":
        output += "\x1b[?25l";
        break;
      case "cursorShow":
        output += "\x1b[?25h";
        break;
      case "cursorMove":
        output += moveCursor(cmd.x, cmd.y);
        break;
      case "cursorTo":
        output += `\x1b[${cmd.col}G`;
        break;
      case "carriageReturn":
        output += "\r";
        break;
      case "hyperlink":
        output += `\x1b]8;;${cmd.uri}\x07`;  // OSC 8 Hyperlink
        break;
      case "style":
        output += ansiStyleCodes(cmd);
        break;
    }
  }

  terminal.write(output);  // EIN write() Aufruf!
}
```

**Wichtig:** Alle Commands werden zu EINEM String zusammengebaut und in EINEM `write()` an stdout gesendet. Das verhindert Flackern.

## Render Scheduling

```javascript
// Throttled Scheduler - verhindert zu viele Renders
const scheduledRender = createThrottled(render, {
  leading: true,   // Erster Aufruf sofort
  trailing: true   // Letzter Aufruf wird nachgeholt
});
```

## React Reconciler

```javascript
// Custom React Reconciler für Terminal
const reconciler = createReconciler({
  createContainer,
  updateContainerSync,    // Synchrones Update (kein Batching)
  flushSyncWork,
  discreteUpdates,        // Für Input Events

  // Host Config:
  createInstance(type, props) {
    // Box → YogaNode + Style
    // Text → TextNode
  },
  appendChildToContainer(container, child) {
    // Kind zu Yoga-Layout hinzufügen
  },
  commitUpdate(instance, updatePayload) {
    // Yoga-Properties aktualisieren
  }
});
```

## Für dein Projekt: Einfaches Rendering

Wenn du nicht Ink/React nutzen willst, hier der Kern-Algorithmus:

```javascript
class TerminalRenderer {
  previousLines = [];

  render(newLines) {
    // 1. Cursor verstecken
    process.stdout.write("\x1b[?25l");

    // 2. Diff berechnen
    const maxLen = Math.max(this.previousLines.length, newLines.length);

    // Zum Anfang des vorherigen Outputs bewegen
    if (this.previousLines.length > 0) {
      process.stdout.write(`\x1b[${this.previousLines.length}A`);
    }

    for (let i = 0; i < maxLen; i++) {
      const prev = this.previousLines[i] || "";
      const next = newLines[i];

      if (next === undefined) {
        // Zeile löschen
        process.stdout.write("\x1b[2K\n");
      } else if (next !== prev) {
        // Zeile aktualisieren
        process.stdout.write(`\x1b[2K${next}\n`);
      } else {
        // Zeile unverändert, einfach runter
        process.stdout.write("\n");
      }
    }

    // 3. Cursor zeigen
    process.stdout.write("\x1b[?25h");

    this.previousLines = newLines;
  }
}
```
