/**
 * VoiceCloneManager — Persists cloned voice metadata to disk.
 * Storage: ~/.helixmind/voice-clones/clones.json
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface VoiceCloneEntry {
  voiceId: string;
  name: string;
  provider: string;
  createdAt: number;
  isActive: boolean;
}

interface CloneStore {
  version: 1;
  clones: VoiceCloneEntry[];
}

const STORE_DIR = join(homedir(), '.helixmind', 'voice-clones');
const STORE_PATH = join(STORE_DIR, 'clones.json');

export class VoiceCloneManager {
  private store: CloneStore;

  constructor() {
    this.store = this.load();
  }

  addClone(entry: VoiceCloneEntry): void {
    this.store.clones.push(entry);
    this.save();
  }

  listClones(): VoiceCloneEntry[] {
    return [...this.store.clones];
  }

  getActiveVoiceId(): string | undefined {
    const active = this.store.clones.find(c => c.isActive);
    return active?.voiceId;
  }

  setActiveVoice(voiceId: string): void {
    for (const clone of this.store.clones) {
      clone.isActive = clone.voiceId === voiceId;
    }
    this.save();
  }

  removeClone(voiceId: string): boolean {
    const idx = this.store.clones.findIndex(c => c.voiceId === voiceId);
    if (idx === -1) return false;
    this.store.clones.splice(idx, 1);
    this.save();
    return true;
  }

  private load(): CloneStore {
    try {
      if (existsSync(STORE_PATH)) {
        const raw = readFileSync(STORE_PATH, 'utf-8');
        return JSON.parse(raw) as CloneStore;
      }
    } catch { /* start fresh */ }
    return { version: 1, clones: [] };
  }

  private save(): void {
    mkdirSync(STORE_DIR, { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(this.store, null, 2), 'utf-8');
  }
}
