'use client';

import { useState, useCallback, memo } from 'react';
import { Copy, Check, CheckCircle2, XCircle, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { ToolBlock } from './ToolBlock';
import { FileAttachmentCard } from './FileAttachment';
import { AnsiLine } from '@/lib/ansi-to-spans';
import type { FileInfo } from './FileAttachment';
import type { ChatMessage } from './AppShell';

interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    const userFiles = message.metadata?.files as FileInfo[] | undefined;
    return (
      <div className="flex justify-end animate-message-in">
        <div className="max-w-[85%] min-w-0">
          <div className="text-[15px] text-cyan-300 whitespace-pre-wrap break-words leading-[1.7] text-right">
            {message.content}
          </div>
          {userFiles && userFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1.5 justify-end">
              {userFiles.map((file, i) => (
                <FileAttachmentCard key={i} file={file} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant message — clean left-aligned, no avatar
  return (
    <div className="animate-message-in">
      <AssistantContent content={message.content} metadata={message.metadata} />
    </div>
  );
});

/* ─── Assistant content parser ────────────────── */

function AssistantContent({
  content,
  metadata,
}: {
  content: string;
  metadata?: Record<string, unknown> | null;
}) {
  const toolCalls = metadata?.toolCalls as Array<{
    name: string;
    input: Record<string, unknown>;
    result?: string;
    status?: string;
  }> | undefined;

  const isCliExecution = metadata?.isCliExecution === true;
  const savedTools = metadata?.tools as Array<{
    name: string;
    status: string;
    result?: string;
  }> | undefined;

  const fileAttachments = metadata?.files as FileInfo[] | undefined;

  const segments = parseContent(content);

  return (
    <div className="space-y-3">
      {/* CLI execution tool summary */}
      {isCliExecution && savedTools && savedTools.length > 0 && (
        <ToolSummary tools={savedTools} />
      )}

      {/* Tool calls */}
      {toolCalls && toolCalls.length > 0 && (
        <div className="space-y-1.5">
          {toolCalls.map((tc, i) => (
            <ToolBlock key={i} tool={tc} />
          ))}
        </div>
      )}

      {/* Content segments — CLI output gets ANSI-colored terminal rendering */}
      {isCliExecution ? (
        <div className="font-mono text-xs whitespace-pre-wrap break-words leading-5">
          {content.split('\n').map((line, i) => (
            <div key={i}><AnsiLine text={line} /></div>
          ))}
        </div>
      ) : (
        segments.map((seg, i) => {
          if (seg.type === 'code') {
            return <CodeBlock key={i} code={seg.content} language={seg.language} />;
          }
          return (
            <div key={i} className="text-[15px] text-gray-200 whitespace-pre-wrap break-words leading-[1.7]">
              {renderInlineMarkdown(seg.content)}
            </div>
          );
        })
      )}

      {/* File attachments */}
      {fileAttachments && fileAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {fileAttachments.map((file, i) => (
            <FileAttachmentCard key={i} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tool Summary (persistent after CLI execution) ─── */

function ToolSummary({ tools }: { tools: Array<{ name: string; status: string; result?: string }> }) {
  const [expanded, setExpanded] = useState(false);

  const doneCount = tools.filter(t => t.status === 'done').length;
  const errorCount = tools.filter(t => t.status === 'error').length;

  return (
    <div className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-1 py-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
      >
        <Wrench size={11} className="text-gray-500" />
        <span>{tools.length} tools used</span>
        {doneCount > 0 && (
          <span className="flex items-center gap-0.5 text-emerald-500/60">
            <CheckCircle2 size={10} /> {doneCount}
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-0.5 text-red-400/60">
            <XCircle size={10} /> {errorCount}
          </span>
        )}
        <span className="ml-auto">
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </span>
      </button>
      {expanded && (
        <div className="px-1 py-1 space-y-1">
          {tools.map((tool, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              {tool.status === 'done' ? (
                <CheckCircle2 size={10} className="text-emerald-500/60 flex-shrink-0" />
              ) : (
                <XCircle size={10} className="text-red-400/60 flex-shrink-0" />
              )}
              <span className="text-gray-500 font-mono">{tool.name}</span>
              {tool.result && (
                <span className="text-gray-600 truncate max-w-[300px] ml-auto">
                  {tool.result.slice(0, 80)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Code block ──────────────────────────────── */

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02]">
        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code */}
      <pre className="p-3 overflow-x-auto text-[13px] font-mono text-gray-300 leading-6 bg-black/20">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ─── Content parser ──────────────────────────── */

interface ContentSegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: 'text', content: text });
    }
    segments.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1] || undefined,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) segments.push({ type: 'text', content: text });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content });
  }

  return segments;
}

/* ─── Inline markdown ─────────────────────────── */

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-300 text-[13px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
