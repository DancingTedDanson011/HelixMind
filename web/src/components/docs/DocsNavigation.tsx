'use client';

import { useMemo } from 'react';
import { usePathname } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { FLAT_DOC_ORDER } from './DocsSidebar';
import { cn } from '@/lib/utils';

export function DocsNavigation() {
  const pathname = usePathname();

  const { prevDoc, nextDoc } = useMemo(() => {
    const match = pathname.match(/\/docs\/(.+)/);
    const currentSlug = match ? match[1] : null;
    if (!currentSlug) return { prevDoc: null, nextDoc: null };

    const idx = FLAT_DOC_ORDER.findIndex((d) => d.slug === currentSlug);
    return {
      prevDoc: idx > 0 ? FLAT_DOC_ORDER[idx - 1] : null,
      nextDoc: idx < FLAT_DOC_ORDER.length - 1 ? FLAT_DOC_ORDER[idx + 1] : null,
    };
  }, [pathname]);

  if (!prevDoc && !nextDoc) return null;

  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {prevDoc ? (
        <Link
          href={`/docs/${prevDoc.slug}` as any}
          className={cn(
            'group flex items-center gap-3 p-4 rounded-xl',
            'glass hover:border-primary/20 transition-all duration-200',
          )}
        >
          <ArrowLeft
            size={16}
            className="text-gray-500 group-hover:text-primary transition-colors flex-shrink-0"
          />
          <div>
            <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
              Previous
            </span>
            <p className="text-sm text-gray-400 group-hover:text-white mt-0.5 transition-colors">
              {prevDoc.title}
            </p>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {nextDoc ? (
        <Link
          href={`/docs/${nextDoc.slug}` as any}
          className={cn(
            'group flex items-center justify-end gap-3 p-4 rounded-xl text-right',
            'glass hover:border-primary/20 transition-all duration-200',
          )}
        >
          <div>
            <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
              Next
            </span>
            <p className="text-sm text-gray-400 group-hover:text-white mt-0.5 transition-colors">
              {nextDoc.title}
            </p>
          </div>
          <ArrowRight
            size={16}
            className="text-gray-500 group-hover:text-primary transition-colors flex-shrink-0"
          />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
