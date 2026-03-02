'use client';

import { useMemo, useCallback } from 'react';
import { File, Image, FileText, FileCode, Download, X } from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

export interface FileInfo {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64?: string;
}

/* ─── Helpers ─────────────────────────────────── */

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string, size: number) {
  if (mime.startsWith('image/')) return <Image size={size} className="text-purple-400" />;
  if (mime.includes('pdf')) return <FileText size={size} className="text-red-400" />;
  if (mime.includes('json') || mime.includes('javascript') || mime.includes('typescript') || mime.includes('xml') || mime.includes('html') || mime.includes('css')) {
    return <FileCode size={size} className="text-cyan-400" />;
  }
  if (mime.startsWith('text/')) return <FileText size={size} className="text-gray-400" />;
  return <File size={size} className="text-gray-400" />;
}

/* ─── Outbound pill (before sending) ──────────── */

interface FileAttachmentPillProps {
  file: FileInfo;
  onRemove?: () => void;
}

export function FileAttachmentPill({ file, onRemove }: FileAttachmentPillProps) {
  const isImage = file.mimeType.startsWith('image/');

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs group">
      {isImage && file.dataBase64 ? (
        <img
          src={`data:${file.mimeType};base64,${file.dataBase64}`}
          alt={file.name}
          className="w-6 h-6 rounded object-cover"
        />
      ) : (
        getFileIcon(file.mimeType, 14)
      )}
      <span className="text-gray-300 truncate max-w-[120px]">{file.name}</span>
      <span className="text-gray-600">{formatSize(file.sizeBytes)}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-0.5 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

/* ─── Inbound attachment (in message bubble) ──── */

interface FileAttachmentCardProps {
  file: FileInfo;
}

export function FileAttachmentCard({ file }: FileAttachmentCardProps) {
  const isImage = file.mimeType.startsWith('image/');

  const handleDownload = useCallback(() => {
    if (!file.dataBase64) return;
    const blob = new Blob(
      [Uint8Array.from(atob(file.dataBase64), c => c.charCodeAt(0))],
      { type: file.mimeType },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = useMemo(() => {
    if (!isImage || !file.dataBase64) return null;
    return `data:${file.mimeType};base64,${file.dataBase64}`;
  }, [isImage, file.dataBase64, file.mimeType]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 max-w-xs">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="w-10 h-10 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
          {getFileIcon(file.mimeType, 18)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 truncate">{file.name}</p>
        <p className="text-[10px] text-gray-600">{formatSize(file.sizeBytes)}</p>
      </div>
      {file.dataBase64 && (
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors flex-shrink-0"
          title="Download"
        >
          <Download size={14} />
        </button>
      )}
    </div>
  );
}
