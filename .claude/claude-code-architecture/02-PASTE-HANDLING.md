# Paste Handling - Bracketed Paste Protocol

## Was ist Bracketed Paste?

Terminals unterstützen ein Protokoll, bei dem eingefügter Text in spezielle Escape-Sequenzen eingewickelt wird:

```
ESC[?2004h          ← Bracketed Paste AKTIVIEREN
ESC[200~            ← PASTE START Marker
...eingefügter Text...
ESC[201~            ← PASTE END Marker
ESC[?2004l          ← Bracketed Paste DEAKTIVIEREN
```

**Ohne Bracketed Paste:** Eingefügter Text wird Zeichen für Zeichen verarbeitet → Enter-Zeichen werden als "Submit" interpretiert → Chaos bei Multiline-Paste.

**Mit Bracketed Paste:** Der gesamte eingefügte Text wird als EIN Event erkannt → kein versehentliches Ausführen.

## Claude Code Implementation

### 1. Aktivierung

```javascript
// Beim Start / Raw Mode aktivieren:
stdout.write("\x1b[?2004h");  // Enable Bracketed Paste

// Beim Beenden:
stdout.write("\x1b[?2004l");  // Disable Bracketed Paste
```

### 2. State Machine im Parser

```javascript
const PASTE_START = "\x1b[200~";
const PASTE_END   = "\x1b[201~";

function parseInput(state, rawInput) {
  let tokens = tokenizer.feed(rawInput);
  let events = [];

  for (let token of tokens) {
    if (token.type === "sequence") {
      if (token.value === PASTE_START) {
        state.mode = "IN_PASTE";
        state.pasteBuffer = "";
      }
      else if (token.value === PASTE_END) {
        events.push({
          kind: "key",
          name: "",
          isPasted: true,
          sequence: state.pasteBuffer,
          raw: state.pasteBuffer,
          ctrl: false, meta: false, shift: false
        });
        state.mode = "NORMAL";
        state.pasteBuffer = "";
      }
      else if (state.mode === "IN_PASTE") {
        state.pasteBuffer += token.value;
      }
      else {
        events.push(parseKeySequence(token.value));
      }
    }
    else if (token.type === "text") {
      if (state.mode === "IN_PASTE") {
        state.pasteBuffer += token.value;
      } else {
        events.push(parseKeySequence(token.value));
      }
    }
  }
}
```

### 3. Timeouts

```javascript
NORMAL_TIMEOUT = 50;    // 50ms - schnell für Tastatureingabe
PASTE_TIMEOUT = 500;    // 500ms - länger für große Paste-Inhalte
```

Große Paste-Inhalte können über mehrere `readable` Events verteilt ankommen. Der längere Timeout verhindert, dass der Paste vorzeitig abgeschlossen wird.

### 4. Paste Aggregation (PE7 Komponente)

```javascript
// React-Komponente die Paste-Events aggregiert
function PasteHandler({ onPaste, onInput, onImagePaste }) {
  const AGGREGATE_TIMEOUT = 100;  // 100ms zum Sammeln

  // Pasted Chunks werden mit 100ms Timeout gesammelt
  // damit große Pastes die in mehreren Teilen ankommen
  // als ein zusammenhängender Paste behandelt werden

  function handleInput(key) {
    if (key.isPasted) {
      // Paste-Chunks sammeln
      appendToPasteBuffer(key.raw);
      resetAggregateTimer();
    } else {
      flushPasteBuffer();
      onInput(key);
    }
  }

  function flushPasteBuffer() {
    if (pasteBuffer.length > 0) {
      // Prüfe ob Bilder enthalten sind
      detectAndHandleImages(pasteBuffer);
      onPaste(pasteBuffer);
      pasteBuffer = "";
    }
  }
}
```

## Image Paste Detection

Claude Code erkennt Bilder in eingefügtem Text:

```javascript
// Datei-Pfade im Paste-Inhalt finden
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|bmp)$/i;

// Prüfe ob eingefügte Pfade auf Bilder zeigen
function detectImages(pastedText) {
  const paths = extractFilePaths(pastedText);
  const imagePaths = paths.filter(p => IMAGE_EXTENSIONS.test(p));

  if (imagePaths.length > 0) {
    // Bilder als Base64 lesen und an API senden
    for (const imgPath of imagePaths) {
      const base64 = readFileAsBase64(imgPath);
      onImagePaste(base64);
    }
  }
}

// Platform-spezifische Clipboard-Bild-Erkennung:
const clipboardChecks = {
  darwin: {
    checkImage: 'osascript -e "clipboard info"',
    saveImage: 'osascript -e "..."'
  },
  win32: {
    checkImage: 'powershell -NoProfile -Command "(Get-Clipboard -Format Image) -ne $null"',
    saveImage: 'powershell -NoProfile -Command "..."'
  }
};
```

## Für dein Projekt: Minimal-Implementierung

```javascript
import { stdin, stdout } from 'process';

// 1. Bracketed Paste aktivieren
stdout.write("\x1b[?2004h");

// 2. Cleanup bei Exit
process.on('exit', () => {
  stdout.write("\x1b[?2004l");
});

// 3. Im Input-Parser
let pasteMode = false;
let pasteBuffer = "";

function processInput(data) {
  if (data.includes("\x1b[200~")) {
    pasteMode = true;
    pasteBuffer = "";
    data = data.replace("\x1b[200~", "");
  }

  if (data.includes("\x1b[201~")) {
    pasteBuffer += data.replace("\x1b[201~", "");
    pasteMode = false;
    handlePaste(pasteBuffer);  // Gesamter Text als ein Event
    return;
  }

  if (pasteMode) {
    pasteBuffer += data;
  } else {
    handleKeypress(data);
  }
}
```
