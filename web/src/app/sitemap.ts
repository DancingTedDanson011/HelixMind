import type { MetadataRoute } from 'next';
import { getAllBlogPosts, getAllDocs } from '@/lib/mdx';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://helixmind.dev';

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/features`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/pricing`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/enterprise`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/docs`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/legal/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/legal/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/legal/imprint`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Dynamic blog posts (both locales)
  const blogEntries: MetadataRoute.Sitemap = [];
  for (const locale of ['en', 'de']) {
    try {
      const posts = await getAllBlogPosts(locale);
      for (const post of posts) {
        blogEntries.push({
          url: `${baseUrl}/${locale}/blog/${post.slug}`,
          lastModified: new Date(post.date),
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    } catch {
      // Content directory may not exist in all environments
    }
  }

  // Dynamic docs (both locales)
  const docEntries: MetadataRoute.Sitemap = [];
  for (const locale of ['en', 'de']) {
    try {
      const docs = await getAllDocs(locale);
      for (const doc of docs) {
        docEntries.push({
          url: `${baseUrl}/${locale}/docs/${doc.slug}`,
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    } catch {
      // Content directory may not exist in all environments
    }
  }

  return [...staticPages, ...blogEntries, ...docEntries];
}
