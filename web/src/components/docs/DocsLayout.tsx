'use client';

import type { ReactNode } from 'react';
import { DocsSidebar } from './DocsSidebar';
import { TableOfContents } from './TableOfContents';

interface DocsLayoutProps {
  children: ReactNode;
  showToc?: boolean;
}

export function DocsLayout({ children, showToc = false }: DocsLayoutProps) {
  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-7xl flex gap-8">
        {/* Left: Sidebar navigation */}
        <DocsSidebar />

        {/* Center: Main content */}
        <main className="flex-1 min-w-0">{children}</main>

        {/* Right: Table of Contents (lg+ only, doc pages only) */}
        {showToc && <TableOfContents />}
      </div>
    </div>
  );
}
