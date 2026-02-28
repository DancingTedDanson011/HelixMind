import { getLocale } from 'next-intl/server';
import { getAllDocs } from '@/lib/mdx';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Link } from '@/i18n/routing';
import { BookOpen } from 'lucide-react';
import { DocsLayout } from '@/components/docs/DocsLayout';

export default async function DocsPage() {
  const locale = await getLocale();
  const docs = await getAllDocs(locale);

  const categories = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    const cat = doc.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  return (
    <DocsLayout>
      <h1 className="text-4xl font-bold mb-4">Documentation</h1>
      <p className="text-gray-400 text-lg mb-12">
        Everything you need to get started with HelixMind.
      </p>

      <div className="space-y-10">
        {Object.entries(categories).map(([category, categoryDocs]) => (
          <div key={category}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              {category}
            </h2>
            <div className="grid gap-3">
              {categoryDocs.map((doc) => (
                <Link key={doc.slug} href={`/docs/${doc.slug}` as any}>
                  <GlassPanel className="p-4 hover:border-primary/20 transition-all cursor-pointer">
                    <div className="flex items-start gap-3">
                      <BookOpen size={18} className="text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-medium text-white">{doc.title}</h3>
                        {doc.description && (
                          <p className="text-sm text-gray-500 mt-1">{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </GlassPanel>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {docs.length === 0 && (
        <GlassPanel className="text-center py-12">
          <BookOpen size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Documentation coming soon.</p>
        </GlassPanel>
      )}
    </DocsLayout>
  );
}
