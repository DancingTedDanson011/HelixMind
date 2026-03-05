import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Mock node:fs to isolate from real filesystem
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => { throw new Error('ENOENT'); }),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import { VoiceCloneManager, type VoiceCloneEntry } from '../../src/cli/voice/clone-manager.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

function makeEntry(name: string, voiceId: string, active = false): VoiceCloneEntry {
  return {
    voiceId,
    name,
    provider: 'elevenlabs',
    createdAt: Date.now(),
    isActive: active,
  };
}

describe('VoiceCloneManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing store
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    mockWriteFileSync.mockImplementation(() => {});
    mockMkdirSync.mockImplementation(() => undefined as any);
  });

  describe('addClone', () => {
    it('should add a clone entry and persist', () => {
      const manager = new VoiceCloneManager();
      const entry = makeEntry('my-voice', 'vid-1');
      manager.addClone(entry);

      const clones = manager.listClones();
      expect(clones).toHaveLength(1);
      expect(clones[0].name).toBe('my-voice');
      expect(clones[0].voiceId).toBe('vid-1');
    });

    it('should persist multiple clones', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('voice-a', 'id-a'));
      manager.addClone(makeEntry('voice-b', 'id-b'));
      expect(manager.listClones()).toHaveLength(2);
    });
  });

  describe('listClones', () => {
    it('should return empty list when no store file exists', () => {
      const manager = new VoiceCloneManager();
      expect(manager.listClones()).toEqual([]);
    });

    it('should return a copy (not a reference)', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1'));
      const list1 = manager.listClones();
      const list2 = manager.listClones();
      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });
  });

  describe('getActiveVoiceId', () => {
    it('should return undefined when no active voice', () => {
      const manager = new VoiceCloneManager();
      expect(manager.getActiveVoiceId()).toBeUndefined();
    });

    it('should return the active voice ID', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('voice-1', 'id-1', true));
      expect(manager.getActiveVoiceId()).toBe('id-1');
    });
  });

  describe('setActiveVoice', () => {
    it('should mark the specified clone as active', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1'));
      manager.addClone(makeEntry('v2', 'id-2'));
      manager.setActiveVoice('id-1');
      expect(manager.getActiveVoiceId()).toBe('id-1');
    });

    it('should deactivate other clones when setting active', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1', true));
      manager.addClone(makeEntry('v2', 'id-2'));
      manager.setActiveVoice('id-2');
      expect(manager.getActiveVoiceId()).toBe('id-2');
      const clones = manager.listClones();
      const v1 = clones.find(c => c.voiceId === 'id-1');
      expect(v1?.isActive).toBe(false);
    });
  });

  describe('removeClone', () => {
    it('should remove a clone entry', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1'));
      const removed = manager.removeClone('id-1');
      expect(removed).toBe(true);
      expect(manager.listClones()).toHaveLength(0);
    });

    it('should return false for non-existent clone', () => {
      const manager = new VoiceCloneManager();
      expect(manager.removeClone('nonexistent')).toBe(false);
    });

    it('should not affect other clones', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1'));
      manager.addClone(makeEntry('v2', 'id-2'));
      manager.removeClone('id-1');
      const clones = manager.listClones();
      expect(clones).toHaveLength(1);
      expect(clones[0].voiceId).toBe('id-2');
    });
  });

  describe('File Persistence', () => {
    it('should call writeFileSync on addClone', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1'));
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should call writeFileSync on removeClone', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1'));
      mockWriteFileSync.mockClear();
      manager.removeClone('id-1');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should call writeFileSync on setActiveVoice', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1'));
      mockWriteFileSync.mockClear();
      manager.setActiveVoice('id-1');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should load from existing store file', () => {
      const store = {
        version: 1,
        clones: [makeEntry('saved-voice', 'saved-id')],
      };
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(store) as any);

      const manager = new VoiceCloneManager();
      const clones = manager.listClones();
      expect(clones).toHaveLength(1);
      expect(clones[0].name).toBe('saved-voice');
    });

    it('should handle corrupt store file gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json!!!' as any);

      const manager = new VoiceCloneManager();
      expect(manager.listClones()).toEqual([]);
    });

    it('should create directory on save', () => {
      const manager = new VoiceCloneManager();
      manager.addClone(makeEntry('v1', 'id-1'));
      expect(mockMkdirSync).toHaveBeenCalled();
    });
  });
});
