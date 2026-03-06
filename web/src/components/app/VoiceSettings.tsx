'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Play, Eye, EyeOff, Mic } from 'lucide-react';
import type { VoiceConfig, VoiceProvider, STTProvider } from '@/lib/cli-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceSettingsProps {
  voiceConfig: VoiceConfig;
  onConfigUpdate: (config: Partial<VoiceConfig>) => void;
  onCloneUpload: (audioBase64: string, name: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Settings panel for configuring voice capture and synthesis.
 * - TTS provider selector (ElevenLabs / Web Speech)
 * - Voice clone upload (drag-drop or file picker)
 * - VAD sensitivity slider
 * - ElevenLabs API key input
 * - Test voice button
 */
export function VoiceSettings({ voiceConfig, onConfigUpdate, onCloneUpload }: VoiceSettingsProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------
  const handleAudioFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
      return;
    }
    const name = cloneName.trim() || file.name.replace(/\.[^.]+$/, '');
    setUploadStatus('uploading');
    try {
      const base64 = await readFileAsBase64(file);
      onCloneUpload(base64, name);
      setUploadStatus('done');
      // stays "done" — resets only on next interaction or error
    } catch {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  }, [cloneName, onCloneUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    if (uploadStatus === 'done' || uploadStatus === 'error') setUploadStatus('idle');
  }, [uploadStatus]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleAudioFile(file);
  }, [handleAudioFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAudioFile(file);
    e.target.value = '';
  }, [handleAudioFile]);

  // ---------------------------------------------------------------------------
  // Test voice
  // ---------------------------------------------------------------------------
  const handleTestVoice = useCallback(() => {
    if (voiceConfig.ttsProvider === 'web_speech' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Hello, I am your HelixMind voice assistant.');
      window.speechSynthesis.speak(utterance);
    }
  }, [voiceConfig.ttsProvider]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <Mic size={12} />
        Voice Settings
      </h3>

      {/* STT Provider */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-gray-500">Speech Recognition</label>
        <div className="flex gap-2">
          {(['whisper', 'web_speech'] as STTProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => onConfigUpdate({ sttProvider: p })}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-medium border transition-all ${
                voiceConfig.sttProvider === p
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]'
              }`}
            >
              {p === 'whisper' ? 'Whisper' : 'Web Speech'}
            </button>
          ))}
        </div>
      </div>

      {/* TTS Provider */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-gray-500">Text-to-Speech</label>
        <div className="flex gap-2">
          {(['elevenlabs', 'web_speech'] as VoiceProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => onConfigUpdate({ ttsProvider: p })}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-medium border transition-all ${
                voiceConfig.ttsProvider === p
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]'
              }`}
            >
              {p === 'elevenlabs' ? 'ElevenLabs' : 'Web Speech'}
            </button>
          ))}
        </div>
      </div>

      {/* ElevenLabs API Key */}
      {voiceConfig.ttsProvider === 'elevenlabs' && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-gray-500">ElevenLabs API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={voiceConfig.elevenLabsApiKey ?? ''}
              onChange={(e) => onConfigUpdate({ elevenLabsApiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-cyan-500/30 focus:bg-white/[0.05] transition-all"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
            >
              {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* Voice Clone Upload */}
      <div className="space-y-2">
        <label className="text-[11px] text-gray-500">Voice Clone</label>

        <input
          type="text"
          value={cloneName}
          onChange={(e) => setCloneName(e.target.value)}
          placeholder="Clone name (optional)"
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-cyan-500/30 transition-all"
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all
            ${isDragOver
              ? 'border-cyan-500/50 bg-cyan-500/5 text-cyan-400'
              : uploadStatus === 'done'
                ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400'
                : uploadStatus === 'error'
                  ? 'border-red-500/40 bg-red-500/5 text-red-400'
                  : 'border-white/[0.08] hover:border-white/[0.15] text-gray-600 hover:text-gray-400'
            }
          `}
        >
          <Upload size={16} className="mx-auto mb-1.5 opacity-70" />
          <p className="text-[11px]">
            {uploadStatus === 'uploading' ? 'Uploading...'
              : uploadStatus === 'done' ? 'Clone uploaded!'
              : uploadStatus === 'error' ? 'Upload failed'
              : isDragOver ? 'Drop audio file'
              : 'Drop audio or click to browse'}
          </p>
          <p className="text-[10px] opacity-50 mt-0.5">MP3, WAV, M4A supported</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* VAD Sensitivity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-gray-500">VAD Sensitivity</label>
          <span className="text-[11px] text-gray-400 font-mono">
            {((voiceConfig.vadSensitivity ?? 0.5) * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={voiceConfig.vadSensitivity ?? 0.5}
          onChange={(e) => onConfigUpdate({ vadSensitivity: parseFloat(e.target.value) })}
          className="w-full accent-cyan-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>Less sensitive</span>
          <span>More sensitive</span>
        </div>
      </div>

      {/* Test Voice */}
      <button
        onClick={handleTestVoice}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
      >
        <Play size={12} />
        Test Voice
      </button>
    </div>
  );
}
