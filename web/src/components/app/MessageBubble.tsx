'use client';

import { useState, useCallback } from 'react';
import { User, Bot, Copy, Check, CheckCircle2, XCircle, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { ToolBlock } from './ToolBlock';
import type { ChatMessage } from './AppShell';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end animate-message-in">
        <div className="max-w-[80%] min-w-0">
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl rounded-tr-md px-4 py-2.5 text-sm text-gray-200 whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <User size={14} className="text-gray-400" />
        </div>
      </div>
    );
  }

  // Assistant message — parse for code blocks and tool calls
  return (
    <div className="flex gap-3 animate-message-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
        <Bot size={14} className="text-cyan-400" />
      </div>
      <div className="flex-1 min-w-0">
        <AssistantContent content={message.content} metadata={message.metadata} />
      </div>
    </div>
  );
}

/* ─── Assistant content parser ────────────────── */

function AssistantContent({
  content,
  metadata,
}: {
  content: string;
  metadata?: Record<string, unknown> | null;
}) {
  // Parse tool calls from metadata
  const toolCalls = metadata?.toolCalls as Array<{
    name: string;
    input: Record<string, unknown>;
    result?: string;
    status?: string;
  }> | undefined;

  // CLI execution tool summary (persistent after completion)
  const isCliExecution = metadata?.isCliExecution === true;
  const savedTools = metadata?.tools as Array<{
    name: string;
    status: string;
    result?: string;
  }> | undefined;

  // Parse content into segments (text + code blocks)
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

      {/* Content segments */}
      {segments.map((seg, i) => {
        if (seg.type === 'code') {
          return <CodeBlock key={i} code={seg.content} language={seg.language} />;
        }
        return (
          <div key={i} className="text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
            {renderInlineMarkdown(seg.content)}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tool Summary (persistent after CLI execution) ─── */

function ToolSummary({ tools }: { tools: Array<{ name: string; status: string; result?: string }> }) {
  const [expanded, setExpanded] = useState(false);

  const doneCount = tools.filter(t => t.status === 'done').length;
  const errorCount = tools.filter(t => t.status === 'error').length;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        <Wrench size={12} className="text-cyan-400" />
        <span>{tools.length} tools used</span>
        {doneCount > 0 && (
          <span className="flex items-center gap-0.5 text-emerald-400">
            <CheckCircle2 size={10} /> {doneCount}
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-0.5 text-red-400">
            <XCircle size={10} /> {errorCount}
          </span>
        )}
        <span className="ml-auto">
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-white/5 px-3 py-2 space-y-1">
          {tools.map((tool, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              {tool.status === 'done' ? (
                <CheckCircle2 size={10} className="text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle size={10} className="text-red-400 flex-shrink-0" />
              )}
              <span className="text-gray-400 font-mono">{tool.name}</span>
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
    <div className="rounded-lg overflow-hidden border border-white/10 bg-[#0a0a1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border-b border-white/5">
        <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code */}
      <pre className="p-3 overflow-x-auto text-xs font-mono text-gray-300 leading-5">
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
    // Text before code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: 'text', content: text });
    }

    // Code block
    segments.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1] || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
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
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-200">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-400 text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
