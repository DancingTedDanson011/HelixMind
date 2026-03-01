'use client';

import dynamic from 'next/dynamic';

const BrainScene = dynamic(
  () => import('@/components/brain/BrainScene').then((m) => m.BrainScene),
  { ssr: false },
);

export default function BrainPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050510', overflow: 'hidden' }}>
      <BrainScene />
    </div>
  );
}
