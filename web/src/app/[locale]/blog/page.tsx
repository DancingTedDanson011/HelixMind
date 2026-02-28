import { getLocale } from 'next-intl/server';
import { getAllBlogPosts } from '@/lib/mdx';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/Badge';
import { Calendar, PenLine } from 'lucide-react';

export default async function BlogPage() {
  const locale = await getLocale();
  const posts = await getAllBlogPosts(locale);

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-4">Blog</h1>
        <p className="text-gray-400 text-lg mb-12">
          Updates, tutorials, and insights about HelixMind and AI coding.
        </p>

        <div className="space-y-6">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}` as any}>
              <GlassPanel className="p-6 hover:border-primary/20 transition-all cursor-pointer group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar size={12} />
                    {new Date(post.date).toLocaleDateString()}
                  </div>
                  {post.tags?.map((tag) => (
                    <Badge key={tag} variant="primary">{tag}</Badge>
                  ))}
                </div>
                <h2 className="text-xl font-semibold text-white group-hover:text-primary transition-colors mb-2">
                  {post.title}
                </h2>
                {post.description && (
                  <p className="text-sm text-gray-400">{post.description}</p>
                )}
              </GlassPanel>
            </Link>
          ))}

          {posts.length === 0 && (
            <GlassPanel className="text-center py-12">
              <PenLine size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">Blog posts coming soon.</p>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}
