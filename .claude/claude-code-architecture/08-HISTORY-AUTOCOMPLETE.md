# History & Autocomplete

## Prompt History

### Speicherformat: JSONL

```javascript
// Datei: ~/.claude/history.jsonl
// Jede Zeile ist ein JSON-Objekt:
{
  "displayText": "Fix the login bug",
  "pastedContents": [],          // ohne Bilder
  "timestamp": 1709553600000,
  "projectPath": "/home/user/project",
  "sessionId": "abc-123"
}
```

### Schreiben (gebuffert)

```javascript
const historyBuffer = [];

function addToHistory(entry) {
  // Große Inhalte (>1024 chars) werden als Hash-Referenz gespeichert
  if (entry.displayText.length > 1024) {
    const hash = sha256(entry.displayText);
    saveContentByHash(hash, entry.displayText);
    entry.displayText = `__hash:${hash}`;
  }

  historyBuffer.push(entry);
}

async function flushHistory() {
  if (historyBuffer.length === 0) return;

  // File Locking (stale: 10s, retries: 3)
  await withFileLock("history.jsonl", async () => {
    const lines = historyBuffer.map(e => JSON.stringify(e)).join("\n");
    await fs.appendFile(historyPath, lines + "\n");
  });

  historyBuffer.length = 0;
}
```

### Navigation (Pfeiltasten)

```javascript
// Up/Down Pfeiltasten navigieren durch History
function useHistory() {
  const [history, setHistory] = useState([]);
  const [index, setIndex] = useState(-1);

  function previous() {
    // -1 = aktuelle Eingabe, 0 = letzte, 1 = vorletzte...
    if (index < history.length - 1) {
      setIndex(index + 1);
      return history[index + 1];
    }
  }

  function next() {
    if (index > 0) {
      setIndex(index - 1);
      return history[index - 1];
    } else if (index === 0) {
      setIndex(-1);
      return "";  // Zurück zur leeren Eingabe
    }
  }

  function reset() {
    setIndex(-1);
  }

  return { previous, next, reset };
}
```

### Ctrl+R History Search

```javascript
// Fuzzy-Suche durch History
function useHistorySearch(history) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  function search(newQuery) {
    setQuery(newQuery);
    // Filtere History-Einträge die den Query enthalten
    const matches = history.filter(entry =>
      entry.toLowerCase().includes(newQuery.toLowerCase())
    );
    setResults(matches);
    setSelectedIndex(0);
  }

  function nextResult() {
    setSelectedIndex(prev => (prev + 1) % results.length);
  }

  function accept() {
    return results[selectedIndex];
  }

  return { search, nextResult, accept, results, selectedIndex };
}
```

## Tab Completion / Autocomplete

### Shell-basierte Completion

```javascript
// Nutzt bash compgen für File/Command Completion
function getCompletions(input, cursorPos) {
  // 1. Bestimme Completion-Typ
  const { prefix, type } = analyzeInput(input, cursorPos);

  // 2. compgen ausführen
  let command;
  switch (type) {
    case "variable":
      command = `compgen -v ${prefix} 2>/dev/null`;
      break;
    case "file":
      command = `compgen -f ${prefix} 2>/dev/null | head -50`;
      break;
    case "command":
      command = `compgen -c ${prefix} 2>/dev/null | head -50`;
      break;
  }

  const result = execSync(command, { encoding: "utf-8" });
  return result.trim().split("\n");
}

function analyzeInput(input, cursorPos) {
  // Shell-Tokens parsen
  const tokens = tokenizeShellInput(input);

  // Letztes Token vor Cursor
  const currentToken = tokens.findLast(t => t.end <= cursorPos);

  if (currentToken?.value.startsWith("$"))
    return { prefix: currentToken.value.slice(1), type: "variable" };
  if (currentToken?.index === 0)
    return { prefix: currentToken.value, type: "command" };
  return { prefix: currentToken?.value || "", type: "file" };
}
```

### @withfig/autocomplete Integration

Claude Code nutzt zusätzlich die **Fig Autocomplete Specs** für intelligentere Vorschläge bei CLI-Befehlen.

## Stash (Ctrl+S)

```javascript
// Stash = Input temporär speichern und leeren
// Wie git stash, aber für die Eingabezeile

function handleStash() {
  if (currentInput.trim()) {
    stashedInput.current = currentInput;
    setInput("");
    showNotification("Input stashed. Ctrl+S to restore.");
  } else if (stashedInput.current) {
    setInput(stashedInput.current);
    stashedInput.current = "";
    showNotification("Input restored from stash.");
  }
}
```

## Für dein Projekt: Einfache History

```javascript
import fs from 'fs';
import path from 'path';
import os from 'os';

class PromptHistory {
  historyFile = path.join(os.homedir(), '.myagent', 'history.jsonl');
  entries = [];
  index = -1;

  async load() {
    try {
      const content = await fs.promises.readFile(this.historyFile, 'utf-8');
      this.entries = content.trim().split('\n')
        .map(line => JSON.parse(line))
        .reverse();  // Neueste zuerst
    } catch {
      this.entries = [];
    }
  }

  async add(text) {
    // Keine Duplikate
    if (this.entries[0]?.text === text) return;

    const entry = { text, timestamp: Date.now() };
    this.entries.unshift(entry);

    await fs.promises.appendFile(
      this.historyFile,
      JSON.stringify(entry) + '\n'
    );
  }

  previous() {
    if (this.index < this.entries.length - 1) {
      this.index++;
      return this.entries[this.index].text;
    }
    return null;
  }

  next() {
    if (this.index > 0) {
      this.index--;
      return this.entries[this.index].text;
    }
    if (this.index === 0) {
      this.index = -1;
      return "";
    }
    return null;
  }

  reset() { this.index = -1; }

  search(query) {
    return this.entries.filter(e =>
      e.text.toLowerCase().includes(query.toLowerCase())
    );
  }
}
```
