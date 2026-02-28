import { createSerwistRoute } from '@serwist/turbopack';

const { GET } = createSerwistRoute({
  swSrc: 'src/app/sw.ts',
  useNativeEsbuild: true,
  additionalPrecacheEntries: [{ url: '/~offline', revision: crypto.randomUUID() }],
});

export { GET };

export const dynamic = 'force-static';
export const dynamicParams = true;
export const revalidate = false;

export function generateStaticParams() {
  return [{ path: 'sw.js' }, { path: 'sw.js.map' }];
}
