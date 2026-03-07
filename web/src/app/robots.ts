import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://helixmind.dev';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/', '/auth/', '/app/', '/support/panel/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
