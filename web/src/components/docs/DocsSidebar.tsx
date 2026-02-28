'use client';

import { useState, useMemo } from 'react';
import { usePathname } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Brain,
  Wrench,
  Sparkles,
  Server,
  FileText,
  Search,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DocEntry {
  slug: string;
  title: string;
}

export interface DocCategory {
  label: string;
  icon: React.ReactNode;
  docs: DocEntry[];
}

export const DOCS_NAVIGATION: DocCategory[] = [
  {
    label: 'Getting Started',
    icon: <BookOpen size={16} />,
    docs: [
      { slug: 'getting-started', title: 'Getting Started' },
      { slug: 'project-setup', title: 'Project Setup' },
      { slug: 'configuration', title: 'Configuration' },
    ],
  },
  {
    label: 'Core Concepts',
    icon: <Brain size={16} />,
    docs: [
      { slug: 'spiral-memory', title: 'Spiral Memory' },
      { slug: 'brain-visualization', title: 'Brain Visualization' },
      { slug: 'feed-pipeline', title: 'Feed Pipeline' },
    ],
  },
  {
    label: 'Agent & Tools',
    icon: <Wrench size={16} />,
    docs: [
      { slug: 'agent-tools', title: 'Agent Tools' },
      { slug: 'slash-commands', title: 'Slash Commands' },
      { slug: 'autonomous-modes', title: 'Autonomous Modes' },
      { slug: 'permission-system', title: 'Permission System' },
    ],
  },
  {
    label: 'Features',
    icon: <Sparkles size={16} />,
    docs: [
      { slug: 'validation-matrix', title: 'Validation Matrix' },
      { slug: 'web-knowledge', title: 'Web Knowledge Enricher' },
      { slug: 'sessions', title: 'Sessions & Background Tasks' },
      { slug: 'security-monitor', title: 'Security Monitor' },
      { slug: 'browser-automation', title: 'Browser Automation' },
      { slug: 'checkpoints', title: 'Checkpoints & Undo' },
      { slug: 'export-import', title: 'Export & Import' },
    ],
  },
  {
    label: 'Providers',
    icon: <Server size={16} />,
    docs: [
      { slug: 'providers', title: 'Providers' },
      { slug: 'ollama-offline', title: 'Ollama & Offline Mode' },
      { slug: 'mcp-integration', title: 'MCP Integration' },
    ],
  },
  {
    label: 'Reference',
    icon: <FileText size={16} />,
    docs: [
      { slug: 'cli-reference', title: 'CLI Reference' },
      { slug: 'troubleshooting', title: 'Troubleshooting' },
      { slug: 'best-practices', title: 'Best Practices' },
    ],
  },
];

/** Flat ordered list of all doc slugs for prev/next navigation */
export const FLAT_DOC_ORDER: DocEntry[] = DOCS_NAVIGATION.flatMap((c) => c.docs);

export function DocsSidebar() {
  const pathname = usePathname();
  const currentSlug = useMemo(() => {
    const match = pathname.match(/\/docs\/(.+)/);
    return match ? match[1] : null;
  }, [pathname]);

  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filteredNav = useMemo(() => {
    if (!searchQuery.trim()) return DOCS_NAVIGATION;
    const q = searchQuery.toLowerCase();
    return DOCS_NAVIGATION.map((cat) => ({
      ...cat,
      docs: cat.docs.filter((doc) => doc.title.toLowerCase().includes(q)),
    })).filter((cat) => cat.docs.length > 0);
  }, [searchQuery]);

  const toggleCategory = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="relative mb-5">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search docs..."
          className={cn(
            'w-full rounded-lg border border-white/10 bg-surface pl-9 pr-4 py-2 text-sm text-white',
            'placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30',
            'transition-all duration-200',
          )}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
        {filteredNav.map((category) => {
          const isCollapsed = collapsed[category.label] && !searchQuery;
          const hasActive = category.docs.some((d) => d.slug === currentSlug);

          return (
            <div key={category.label} className="mb-1">
              <button
                onClick={() => toggleCategory(category.label)}
                className={cn(
                  'flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                  hasActive
                    ? 'text-primary/80'
                    : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <span className="flex items-center gap-2">
                  {category.icon}
                  {category.label}
                </span>
                <motion.span
                  animate={{ rotate: isCollapsed ? -90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={12} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-0.5 ml-2 border-l border-white/5 space-y-0.5">
                      {category.docs.map((doc) => {
                        const isActive = doc.slug === currentSlug;
                        return (
                          <Link
                            key={doc.slug}
                            href={`/docs/${doc.slug}` as any}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'block text-[13px] py-1.5 pl-4 pr-3 ml-px rounded-r-lg transition-all duration-150',
                              isActive
                                ? 'text-primary bg-primary/5 border-l-2 border-primary -ml-px font-medium'
                                : 'text-gray-400 hover:text-white hover:bg-white/5',
                            )}
                          >
                            {doc.title}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filteredNav.length === 0 && (
          <p className="text-sm text-gray-600 px-3 py-4">
            No docs matching &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-20 left-4 z-40 p-2 rounded-lg border border-white/10 bg-surface/90 backdrop-blur-sm text-gray-400 hover:text-white transition-colors"
        aria-label="Open docs navigation"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-72 z-50 md:hidden glass-strong p-5 pt-20 overflow-y-auto"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0">
        <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
          {sidebarContent}
        </div>
      </aside>
    </>
  );
}
