# Undo & Rewind System

Claude Code hat ZWEI separate Undo/Rewind-Systeme:

1. **Input Undo** (Ctrl+_) - Texteingabe rückgängig machen
2. **FileHistory Rewind** (/rewind) - Dateiänderungen rückgängig machen

## 1. Input Undo System

### Undo Buffer

```javascript
function useUndoBuffer({ maxBufferSize = 50, debounceMs = 1000 }) {
  const [buffer, setBuffer] = useState([]);    // Array von Input-States
  const [pointer, setPointer] = useState(-1);  // Aktueller Undo-Index
  const debounceTimer = useRef(0);
  const timeoutRef = useRef(null);

  // Push: Neuen State in Buffer speichern (mit Debounce)
  const pushToBuffer = useCallback((state) => {
    // Debounce: Nur alle 1000ms einen neuen Eintrag
    // → Verhindert, dass jeder Tastendruck gespeichert wird
    // → Gruppiert schnelle Eingaben zu einem Undo-Schritt
    const now = Date.now();
    if (now - debounceTimer.current > debounceMs) {
      setBuffer(prev => [...prev, state]);
      debounceTimer.current = now;
    }
  }, [debounceMs]);

  // Undo: Zum vorherigen State zurückkehren
  const undo = useCallback(() => {
    const index = Math.max(0, pointer - 1);
    const entry = buffer[index];
    if (entry) {
      setPointer(index);
      return entry;  // Vorherigen Input-State zurückgeben
    }
  }, [buffer, pointer]);

  // Clear: Buffer leeren (z.B. nach Submit)
  const clearBuffer = useCallback(() => {
    setBuffer([]);
    setPointer(-1);
  }, []);

  const canUndo = pointer > 0 && buffer.length > 1;

  return { pushToBuffer, undo, canUndo, clearBuffer };
}
```

### Keybinding

```javascript
// Ctrl+_ oder Ctrl+Shift+- → chat:undo
"ctrl+_": "chat:undo",
"ctrl+shift+-": "chat:undo",
```

### Integration

```javascript
// In der Chat-Komponente:
const { pushToBuffer, undo, canUndo, clearBuffer } = useUndoBuffer({
  maxBufferSize: 50,
  debounceMs: 1000
});

// Bei jeder Input-Änderung:
useEffect(() => {
  pushToBuffer({
    input: currentInput,
    pastedContents: pastedContents,
    cursorOffset: cursorOffset
  });
}, [currentInput]);

// Undo-Handler:
function handleUndo() {
  const prev = undo();
  if (prev) {
    setInput(prev.input);
    setCursorOffset(prev.cursorOffset);
    setPastedContents(prev.pastedContents);
  }
}
```

## 2. FileHistory / Rewind System

Das mächtigere System: Macht DATEIÄNDERUNGEN rückgängig, die Claude gemacht hat.

### Architektur

```
┌──────────────────────────────────────┐
│           FileHistory State          │
│  ┌────────────────────────────────┐  │
│  │  trackedFiles: Set<string>     │  │ ← Alle bearbeiteten Dateien
│  │  snapshots: Snapshot[]         │  │ ← Snapshots pro Message
│  │  snapshotSequence: number      │  │
│  └────────────────────────────────┘  │
│                                      │
│  Snapshot {                          │
│    messageId: string                 │ ← Zuordnung zur AI-Message
│    trackedFileBackups: {             │
│      [filePath]: {                   │
│        backupFileName: string|null   │ ← null = Datei existierte nicht
│        version: number               │
│        backupTime: Date              │
│      }                              │
│    }                                 │
│    timestamp: Date                   │
│  }                                   │
└──────────────────────────────────────┘
```

### Wie Backups funktionieren

```javascript
// VOR jeder Datei-Bearbeitung:
async function trackFileEdit(updateState, filePath, messageId) {
  updateState((state) => {
    const snapshot = state.snapshots.at(-1);  // Neuester Snapshot

    // Prüfe ob Datei schon getracked wird
    if (snapshot.trackedFileBackups[filePath]) return state;

    // Backup erstellen
    const isNewFile = !fs.existsSync(filePath);
    const backup = isNewFile
      ? createBackup(null, 1)       // null = Datei existierte nicht
      : createBackup(filePath, 1);  // Kopie der Original-Datei

    // Backup-Datei speichern
    snapshot.trackedFileBackups[filePath] = backup;

    return { ...state, trackedFiles: state.trackedFiles.add(filePath) };
  });
}
```

### Backup-Datei Benennung

```javascript
function createBackupFileName(filePath, version) {
  // SHA256 Hash des Dateipfads + Version
  const hash = sha256(filePath).slice(0, 16);
  return `${hash}@v${version}`;
}

function getBackupPath(backupFileName, sessionId) {
  // Backup-Dateien liegen im Claude Home Verzeichnis
  // ~/.claude/file-history/{sessionId}/{backupFileName}
  return path.join(claudeHome, "file-history", sessionId, backupFileName);
}
```

### Snapshot pro Message

```javascript
// Nach jeder AI-Nachricht wird ein Snapshot erstellt:
async function createSnapshot(updateState, messageId) {
  updateState((state) => {
    const snapshot = {
      messageId: messageId,
      trackedFileBackups: {},
      timestamp: new Date()
    };

    // Für jede getrackte Datei: aktuellen Zustand sichern
    for (const filePath of state.trackedFiles) {
      if (!fs.existsSync(filePath)) {
        // Datei wurde gelöscht
        snapshot.trackedFileBackups[filePath] = {
          backupFileName: null,
          version: prevVersion + 1,
          backupTime: new Date()
        };
      } else {
        // Hat sich die Datei seit letztem Backup geändert?
        const prevBackup = findPreviousBackup(filePath);
        if (prevBackup && fileUnchanged(filePath, prevBackup)) {
          // Gleichen Backup wiederverwenden
          snapshot.trackedFileBackups[filePath] = prevBackup;
        } else {
          // Neues Backup erstellen
          snapshot.trackedFileBackups[filePath] = createBackup(filePath, newVersion);
        }
      }
    }

    // Max Snapshots begrenzen
    const snapshots = [...state.snapshots, snapshot];
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
    }

    return { ...state, snapshots };
  });
}
```

### Rewind (Zurückspulen)

```javascript
async function rewindToMessage(updateState, messageId) {
  updateState((state) => {
    // Snapshot für die gewählte Message finden
    const targetSnapshot = state.snapshots.findLast(
      s => s.messageId === messageId
    );

    if (!targetSnapshot) {
      throw new Error("Snapshot not found");
    }

    // Alle getrackten Dateien wiederherstellen
    for (const filePath of state.trackedFiles) {
      const originalPath = resolveFilePath(filePath);
      const backup = targetSnapshot.trackedFileBackups[filePath];

      // Backup-Datei finden (direkt oder aus History)
      const backupFile = backup
        ? backup.backupFileName
        : findBackupInHistory(filePath, state);

      if (backupFile === null) {
        // Datei existierte damals nicht → löschen
        if (fs.existsSync(originalPath)) {
          fs.unlinkSync(originalPath);
        }
      } else if (backupFile) {
        // Datei aus Backup wiederherstellen
        restoreFromBackup(originalPath, backupFile);
      }
    }
  });
}

function restoreFromBackup(targetPath, backupFileName) {
  const backupPath = getBackupPath(backupFileName);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  const content = fs.readFileSync(backupPath, "utf-8");
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(targetPath, content, { encoding: "utf-8", flush: true });
}
```

### Dry Run (Vorschau)

```javascript
// Zeigt an, was sich ändern würde, OHNE tatsächlich zu ändern
function previewRewind(state, targetSnapshot) {
  const changes = { filesChanged: [], insertions: 0, deletions: 0 };

  for (const filePath of state.trackedFiles) {
    const backup = targetSnapshot.trackedFileBackups[filePath];
    const currentContent = readFileOrEmpty(filePath);
    const backupContent = readBackupOrEmpty(backup);

    const diff = computeDiff(currentContent, backupContent);
    if (diff.insertions || diff.deletions) {
      changes.filesChanged.push(filePath);
      changes.insertions += diff.insertions;
      changes.deletions += diff.deletions;
    }
  }

  return changes;
}
```

### Transcript-Persistenz

```javascript
// Snapshots werden im Transcript gespeichert
async function recordFileHistorySnapshot(messageId, snapshot, isUpdate) {
  await transcriptFile.appendEntry({
    type: "file-history-snapshot",
    messageId: messageId,
    snapshot: snapshot,
    isSnapshotUpdate: isUpdate
  });
}
```

### Environment Variable

```javascript
// FileHistory kann aktiviert/deaktiviert werden:
CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING   // Aktivieren
CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING      // Deaktivieren
```

## Für dein Projekt: Minimal Rewind System

```javascript
class FileHistory {
  snapshots = [];
  trackedFiles = new Set();
  backupDir = path.join(os.homedir(), '.myagent', 'backups');

  async trackFile(filePath) {
    if (this.trackedFiles.has(filePath)) return;
    this.trackedFiles.add(filePath);
  }

  async createSnapshot(messageId) {
    const backup = {};
    for (const file of this.trackedFiles) {
      if (fs.existsSync(file)) {
        const hash = crypto.createHash('sha256')
          .update(file).digest('hex').slice(0, 16);
        const backupPath = path.join(this.backupDir, hash);
        fs.copyFileSync(file, backupPath);
        backup[file] = backupPath;
      } else {
        backup[file] = null;
      }
    }
    this.snapshots.push({ messageId, backup, time: new Date() });
  }

  async rewindTo(messageId) {
    const snapshot = this.snapshots.findLast(s => s.messageId === messageId);
    if (!snapshot) throw new Error('Snapshot not found');

    for (const [file, backupPath] of Object.entries(snapshot.backup)) {
      if (backupPath === null) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } else {
        fs.copyFileSync(backupPath, file);
      }
    }

    // Snapshots nach dem Rewind-Punkt entfernen
    const idx = this.snapshots.indexOf(snapshot);
    this.snapshots = this.snapshots.slice(0, idx + 1);
  }
}
```
