'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Pencil,
  FolderOpen,
  Search,
  Terminal,
  GitBranch,
  Globe,
  CheckCircle2,
  XCircle,
  Wrench,
} from 'lucide-react';

const TOOL_ICONS: Record<string, React.ReactNode> = {
  read_file: <FileText size={13} />,
  write_file: <Pencil size={13} />,
  edit_file: <Pencil size={13} />,
  list_directory: <FolderOpen size={13} />,
  search_files: <Search size={13} />,
  find_files: <Search size={13} />,
  run_command: <Terminal size={13} />,
  git_status: <GitBranch size={13} />,
  git_diff: <GitBranch size={13} />,
  git_commit: <GitBranch size={13} />,
  git_log: <GitBranch size={13} />,
  spiral_query: <Globe size={13} />,
  spiral_store: <Globe size={13} />,
  web_research: <Globe size={13} />,
};

interface ToolBlockProps {
  tool: {
    name: string;
    input: Record<string, unknown>;
    result?: string;
    status?: string;
  };
}

export function ToolBlock({ tool }: ToolBlockProps) {
  const t = useTranslations('app');
  const [expanded, setExpanded] = useState(false);

  const icon = TOOL_ICONS[tool.name] || <Wrench size={13} />;
  const isError = tool.status === 'error' || tool.result?.startsWith('Error:');
  const summary = formatToolSummary(tool.name, tool.input);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-gray-500">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="text-gray-400">{icon}</span>
        <span className="flex-1 text-xs font-mono text-gray-400 truncate">
          {tool.name}: {summary}
        </span>
        {isError ? (
          <XCircle size={13} className="text-red-400 flex-shrink-0" />
        ) : (
          <CheckCircle2 size={13} className="text-green-500/60 flex-shrink-0" />
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/5 px-3 py-2 space-y-2">
          {/* Input */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-1">
              {t('toolCall')}
            </div>
            <pre className="text-[11px] font-mono text-gray-500 bg-black/20 rounded px-2 py-1.5 overflow-x-auto max-h-32">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {tool.result && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-1">
                {t('toolResult')}
              </div>
              <pre
                className={`text-[11px] font-mono rounded px-2 py-1.5 overflow-x-auto max-h-48 ${
                  isError
                    ? 'text-red-400 bg-red-500/5'
                    : 'text-gray-500 bg-black/20'
                }`}
              >
                {tool.result.length > 2000 ? tool.result.slice(0, 2000) + '\n... (truncated)' : tool.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────── */

function formatToolSummary(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'read_file':
    case 'write_file':
    case 'edit_file':
      return shortenPath(String(input.path || ''));
    case 'list_directory':
      return shortenPath(String(input.path || '.'));
    case 'search_files':
      return `"${input.pattern}"`;
    case 'find_files':
      return String(input.pattern || '');
    case 'run_command': {
      const cmd = String(input.command || '');
      return cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd;
    }
    case 'git_commit':
      return `"${String(input.message || '').slice(0, 40)}"`;
    case 'spiral_query':
      return `"${input.query}"`;
    case 'web_research':
      return `"${String(input.query || '').slice(0, 40)}"`;
    default:
      return JSON.stringify(input).slice(0, 60);
  }
}

function shortenPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 3) return normalized;
  return '.../' + parts.slice(-3).join('/');
}
