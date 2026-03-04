# Keybinding System - Context-Aware

## Architektur

Claude Code hat ein **kontext-basiertes Keybinding-System**. Je nach aktivem UI-Zustand gelten andere Bindings.

## Kontexte und ihre Bindings

### Global (immer aktiv)

```javascript
{
  "ctrl+c":  "app:interrupt",       // Abbrechen
  "ctrl+d":  "app:exit",            // Beenden
  "ctrl+t":  "app:toggleTodos",     // Todo-Liste ein/aus
  "ctrl+o":  "app:toggleTranscript" // Transcript ein/aus
}
```

### Chat (während Eingabe)

```javascript
{
  "escape":         "chat:cancel",          // Abbrechen
  "ctrl+f":         "chat:killAgents",      // Agenten beenden
  "ctrl+g":         "chat:externalEditor",  // $EDITOR öffnen
  "ctrl+s":         "chat:stash",           // Input stashen
  "ctrl+_":         "chat:undo",            // Undo
  "ctrl+shift+-":   "chat:undo",            // Undo (Alternative)
  "ctrl+r":         "history:search",       // History-Suche
  "enter":          "chat:submit",          // Absenden
  "up":             "history:previous",     // Vorherige Eingabe
  "down":           "history:next",         // Nächste Eingabe
  "meta+m":         "chat:cycleMode",       // Modus wechseln
  "meta+shift+m":   "chat:modelPicker",     // Modell wählen
  "meta+o":         "chat:fastMode",        // Fast Mode
  "meta+t":         "chat:thinkingToggle",  // Thinking ein/aus
}
```

### Autocomplete (während Tab-Completion)

```javascript
{
  "tab":    "autocomplete:accept",    // Vorschlag übernehmen
  "escape": "autocomplete:dismiss",   // Verwerfen
  "up":     "autocomplete:previous",  // Vorheriger Vorschlag
  "down":   "autocomplete:next"       // Nächster Vorschlag
}
```

### Bestätigung (Permission-Dialoge)

```javascript
{
  "y":      "confirm:yes",     // Ja
  "n":      "confirm:no",      // Nein
  "enter":  "confirm:yes",     // Ja (Enter)
  "escape": "confirm:no"       // Nein (Escape)
}
```

### History Search (Ctrl+R)

```javascript
{
  "ctrl+r": "historySearch:next",     // Nächstes Ergebnis
  "escape": "historySearch:accept",   // Auswahl übernehmen
  "tab":    "historySearch:accept",   // Auswahl übernehmen
  "enter":  "historySearch:execute"   // Direkt ausführen
}
```

## Handler-Registrierung

```javascript
// Jede Komponente registriert ihre Handler:
useEffect(() => {
  if (!keybindingManager) return;

  return keybindingManager.registerHandler({
    action: "chat:submit",
    context: "Chat",
    handler: () => {
      submitMessage(currentInput);
    }
  });
}, [keybindingManager, submitMessage, currentInput]);
```

## Benutzer-Konfiguration

Benutzer können Keybindings anpassen in `~/.claude/keybindings.json`.

## Für dein Projekt: Minimal Implementation

```javascript
class KeybindingManager {
  contexts = new Map();       // context → Map<action, handler>
  bindings = new Map();       // context → Map<keyCombo, action>
  activeContext = "global";

  constructor() {
    // Default Bindings laden
    this.addBinding("global", "ctrl+c", "app:interrupt");
    this.addBinding("global", "ctrl+d", "app:exit");
    this.addBinding("chat", "enter", "chat:submit");
    this.addBinding("chat", "ctrl+_", "chat:undo");
    // ...
  }

  addBinding(context, keyCombo, action) {
    if (!this.bindings.has(context)) {
      this.bindings.set(context, new Map());
    }
    this.bindings.get(context).set(keyCombo, action);
  }

  registerHandler(context, action, handler) {
    if (!this.contexts.has(context)) {
      this.contexts.set(context, new Map());
    }
    this.contexts.get(context).set(action, handler);
    return () => this.contexts.get(context)?.delete(action);
  }

  setContext(context) {
    this.activeContext = context;
  }

  handleKey(keyEvent) {
    const combo = this.keyToCombo(keyEvent);

    // Zuerst aktiven Kontext prüfen
    const contextBindings = this.bindings.get(this.activeContext);
    if (contextBindings?.has(combo)) {
      const action = contextBindings.get(combo);
      const handler = this.contexts.get(this.activeContext)?.get(action);
      if (handler) { handler(keyEvent); return true; }
    }

    // Dann globale Bindings
    const globalBindings = this.bindings.get("global");
    if (globalBindings?.has(combo)) {
      const action = globalBindings.get(combo);
      const handler = this.contexts.get("global")?.get(action);
      if (handler) { handler(keyEvent); return true; }
    }

    return false;
  }

  keyToCombo(key) {
    const parts = [];
    if (key.ctrl) parts.push("ctrl");
    if (key.meta) parts.push("meta");
    if (key.shift) parts.push("shift");
    parts.push(key.name || key.raw);
    return parts.join("+");
  }
}
```
