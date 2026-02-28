import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getBlogPost } from '@/lib/mdx';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Calendar, User } from 'lucide-react';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const post = await getBlogPost(slug, locale);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/blog"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          All Posts
        </Link>

        <GlassPanel className="p-8 lg:p-12">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Calendar size={14} />
              {new Date(post.meta.date).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            {post.meta.author && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <User size={14} />
                {post.meta.author}
              </div>
            )}
            {post.meta.tags?.map((tag) => (
              <Badge key={tag} variant="primary">{tag}</Badge>
            ))}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold mb-4">{post.meta.title}</h1>
          {post.meta.description && (
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">{post.meta.description}</p>
          )}

          <hr className="border-white/5 mb-8" />

          <div className="prose prose-invert prose-sm max-w-none
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
          ">
            {post.content}
          </div>
        </GlassPanel>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link
            href="/blog"
            className="text-sm text-gray-500 hover:text-primary transition-colors"
          >
            Back to all posts
          </Link>
        </div>
      </div>
    </div>
  );
}
