'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { List } from 'lucide-react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Extract headings from the rendered doc content
  useEffect(() => {
    // Small delay to let MDX content render
    const timer = setTimeout(() => {
      const contentEl = document.querySelector('[data-docs-content]');
      if (!contentEl) return;

      const elements = contentEl.querySelectorAll('h2, h3');
      const items: TocItem[] = [];

      elements.forEach((el) => {
        const id = el.getAttribute('id');
        if (id) {
          items.push({
            id,
            text: el.textContent || '',
            level: el.tagName === 'H2' ? 2 : 3,
          });
        }
      });

      setHeadings(items);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Scrollspy via IntersectionObserver
  useEffect(() => {
    if (headings.length === 0) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    if (headingElements.length === 0) return;

    const callback: IntersectionObserverCallback = (entries) => {
      // Find the first visible heading
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length > 0) {
        // Pick the one closest to the top
        const sorted = visible.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        );
        const id = sorted[0].target.getAttribute('id');
        if (id) setActiveId(id);
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    });

    headingElements.forEach((el) => observerRef.current!.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings]);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden lg:block w-56 flex-shrink-0">
      <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
          <List size={12} />
          On this page
        </div>
        <nav className="border-l border-white/5">
          {headings.map((heading) => (
            <button
              key={heading.id}
              onClick={() => handleClick(heading.id)}
              className={cn(
                'block w-full text-left text-[13px] py-1.5 pr-2 transition-all duration-150 border-l -ml-px',
                heading.level === 2 ? 'pl-4' : 'pl-7',
                activeId === heading.id
                  ? 'text-primary border-primary font-medium'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-white/20',
              )}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
