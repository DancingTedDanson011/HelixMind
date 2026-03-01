'use client';

import dynamic from 'next/dynamic';

const BrainSceneV2 = dynamic(
  () => import('@/components/brain/v2/BrainSceneV2').then((m) => m.BrainSceneV2),
  { ssr: false },
);

export default function BrainPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#030308', overflow: 'hidden' }}>
      <BrainSceneV2 />
    </div>
  );
}
