# Input System - 5-Layer Pipeline

## Architektur-Überblick

```
stdin (raw TTY)
  │
  ▼
[1] setRawMode + readable Event
  │
  ▼
[2] ANSI Tokenizer (TM6) ─── State Machine
  │
  ▼
[3] Key Parser (aJ7) ─── Strukturierte Key Events
  │
  ▼
[4] React Reconciler ─── discreteUpdates Batch
  │
  ▼
[5] useInput Hook (HA) ─── React-Komponenten konsumieren Events
```

## Layer 1: Raw Stdin

```javascript
// InternalApp Klasse (n91)
class InternalApp {
  rawModeEnabledCount = 0;
  NORMAL_TIMEOUT = 50;    // ms für unvollständige Escape-Sequenzen
  PASTE_TIMEOUT = 500;    // ms für Paste-Modus

  handleSetRawMode = (enabled) => {
    stdin.setEncoding("utf8");
    if (enabled) {
      stdin.ref();
      stdin.setRawMode(true);
      stdin.addListener("readable", this.handleReadable);
      // Bracketed Paste aktivieren
      stdout.write(ENABLE_BRACKETED_PASTE);  // ESC[?2004h
      // Focus Events aktivieren
      stdout.write(ENABLE_FOCUS_EVENTS);
    }
  };

  handleReadable = () => {
    let data;
    while ((data = this.props.stdin.read()) !== null)
      this.processInput(data);
  };
}
```

**Wichtig für dein Projekt:**
- `stdin.setRawMode(true)` gibt dir JEDEN Tastendruck einzeln
- `stdin.setEncoding("utf8")` statt Buffer
- `readable` Event statt `data` Event (mehr Kontrolle)
- Referenz-Counting für rawMode (`rawModeEnabledCount`) damit mehrere Komponenten es anfordern können

## Layer 2: ANSI Tokenizer (State Machine)

```javascript
// Funktion TM6 - Tokenisiert raw stdin in ANSI-Sequenzen vs. Text
function ansiTokenizer() {
  // State Machine mit Zuständen:
  // - GROUND: normaler Text
  // - ESCAPE: ESC empfangen, warte auf [ oder O
  // - CSI: Control Sequence Introducer (ESC[...)
  // - SS3: Single Shift 3 (ESC O...)

  return {
    feed(rawInput) {
      // Gibt Array von Tokens zurück:
      // { type: "sequence", value: "\x1b[A" }  // z.B. Pfeil hoch
      // { type: "text", value: "hello" }        // normaler Text
    }
  };
}
```

**Warum ein Tokenizer?**
- ANSI Escape-Sequenzen können über mehrere `readable` Events verteilt ankommen
- Timeout-basiert: wenn nach 50ms keine Sequenz komplett → als Text behandeln
- Trennt sauber zwischen Steuerzeichen und Benutzereingabe

## Layer 3: Key Parser

```javascript
function parseKeys(state, rawInput) {
  let tokens = tokenizer.feed(rawInput);
  let events = [];

  for (let token of tokens) {
    if (token.type === "sequence") {
      if (token.value === "\x1b[200~")      // Paste Start
        state.mode = "IN_PASTE";
      else if (token.value === "\x1b[201~")  // Paste End
        events.push(createPasteEvent(state.pasteBuffer));
      else
        events.push(parseKeySequence(token.value));
    } else {
      events.push(parseKeySequence(token.value));
    }
  }
  return events;
}
```

## Layer 4: Key Event Struktur

Jedes Key Event ist ein strukturiertes Objekt:

```javascript
{
  kind: "key",
  name: "return",     // benannter Key oder ""
  fn: false,          // Funktionstasten-Modifier
  ctrl: false,        // Ctrl gedrückt
  meta: false,        // Meta/Alt gedrückt
  shift: false,       // Shift gedrückt
  option: false,      // Option (Mac)
  sequence: "\r",     // raw Escape-Sequenz
  raw: "\r",          // rohes Zeichen
  isPasted: false     // true wenn aus Paste
}
```

### Key-Name Mapping

```javascript
const KEY_MAP = {
  "OP": "f1", "OQ": "f2", "OR": "f3", "OS": "f4",
  "[A]": "up", "[B]": "down", "[C]": "right", "[D]": "left",
  "[H]": "home", "[F]": "end",
  "[2~]": "insert", "[3~]": "delete",
  "[5~]": "pageup", "[6~]": "pagedown",
  // F5-F12, modifizierte Varianten etc.
};
```

## Layer 5: useInput React Hook

```javascript
function useInput(callback, options = {}) {
  const { setRawMode, eventEmitter } = useStdin();

  useLayoutEffect(() => {
    if (options.isActive === false) return;
    setRawMode(true);
    return () => setRawMode(false);
  }, [options.isActive]);

  useEffect(() => {
    const handler = (event) => callback(event);
    eventEmitter.on("input", handler);
    return () => eventEmitter.off("input", handler);
  }, [callback]);
}

// Nutzung in Komponenten:
useInput((key) => {
  if (key.name === "return" && !key.shift) {
    submitMessage();
  }
  if (key.ctrl && key.name === "c") {
    handleInterrupt();
  }
});
```

## Für dein Projekt: Implementierungs-Reihenfolge

1. **Raw Mode aktivieren** → `process.stdin.setRawMode(true)`
2. **ANSI Tokenizer bauen** → State Machine die ESC-Sequenzen erkennt
3. **Key Events parsen** → Strukturierte Objekte mit Modifiern
4. **Event Emitter** → Events an UI-Komponenten weiterleiten
5. **Timeout-Handling** → 50ms für unvollständige Sequenzen
