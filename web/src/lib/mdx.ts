import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export interface DocMeta {
  title: string;
  description: string;
  slug: string;
  order?: number;
  category?: string;
}

export interface BlogMeta {
  title: string;
  description: string;
  slug: string;
  date: string;
  author?: string;
  tags?: string[];
  image?: string;
}

export async function getDocSlugs(locale: string): Promise<string[]> {
  const dir = path.join(CONTENT_DIR, 'docs', locale);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace('.mdx', ''));
}

export async function getDoc(slug: string, locale: string) {
  const filePath = path.join(CONTENT_DIR, 'docs', locale, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const source = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(source);

  const { content: mdxContent } = await compileMDX({
    source: content,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
      },
    },
  });

  return {
    meta: { ...data, slug } as DocMeta,
    content: mdxContent,
  };
}

export async function getAllDocs(locale: string): Promise<DocMeta[]> {
  const slugs = await getDocSlugs(locale);
  const docs: DocMeta[] = [];

  for (const slug of slugs) {
    const filePath = path.join(CONTENT_DIR, 'docs', locale, `${slug}.mdx`);
    const source = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(source);
    docs.push({ ...data, slug } as DocMeta);
  }

  return docs.sort((a, b) => (a.order || 99) - (b.order || 99));
}

export async function getBlogSlugs(locale: string): Promise<string[]> {
  const dir = path.join(CONTENT_DIR, 'blog', locale);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace('.mdx', ''));
}

export async function getBlogPost(slug: string, locale: string) {
  const filePath = path.join(CONTENT_DIR, 'blog', locale, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const source = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(source);

  const { content: mdxContent } = await compileMDX({
    source: content,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
      },
    },
  });

  return {
    meta: { ...data, slug } as BlogMeta,
    content: mdxContent,
  };
}

export async function getAllBlogPosts(locale: string): Promise<BlogMeta[]> {
  const slugs = await getBlogSlugs(locale);
  const posts: BlogMeta[] = [];

  for (const slug of slugs) {
    const filePath = path.join(CONTENT_DIR, 'blog', locale, `${slug}.mdx`);
    const source = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(source);
    posts.push({ ...data, slug } as BlogMeta);
  }

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
