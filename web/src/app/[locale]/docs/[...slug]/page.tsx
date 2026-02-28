import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getDoc } from '@/lib/mdx';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Link } from '@/i18n/routing';
import { ChevronRight } from 'lucide-react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { DocsNavigation } from '@/components/docs/DocsNavigation';

interface DocPageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const docSlug = slug.join('/');
  const doc = await getDoc(docSlug, locale);

  if (!doc) {
    notFound();
  }

  return (
    <DocsLayout showToc>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/docs" className="hover:text-primary transition-colors">
          Docs
        </Link>
        <ChevronRight size={14} />
        {doc.meta.category && (
          <>
            <span>{doc.meta.category}</span>
            <ChevronRight size={14} />
          </>
        )}
        <span className="text-white">{doc.meta.title}</span>
      </div>

      <GlassPanel className="p-8 lg:p-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">{doc.meta.title}</h1>
        {doc.meta.description && (
          <p className="text-gray-400 text-lg mb-8">{doc.meta.description}</p>
        )}
        <div
          data-docs-content
          className="prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-400 prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-code:text-primary prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-[#0a0a1a] prose-pre:border prose-pre:border-white/5 prose-pre:rounded-xl
            prose-li:text-gray-400
            prose-strong:text-white
            prose-blockquote:border-primary/30 prose-blockquote:text-gray-400
            prose-table:text-gray-400
            prose-th:text-white prose-th:font-semibold
            prose-td:border-white/5
            prose-th:border-white/10
          "
        >
          {doc.content}
        </div>
      </GlassPanel>

      <DocsNavigation />
    </DocsLayout>
  );
}
