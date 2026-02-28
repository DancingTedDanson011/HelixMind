'use client';

import { Suspense, lazy } from 'react';

const BrainScene = lazy(() => import('./BrainScene').then((m) => ({ default: m.BrainScene })));

export function BrainCanvas() {
  return (
    <div className="absolute inset-0 z-0">
      <Suspense fallback={<BrainFallback />}>
        <BrainScene />
      </Suspense>
    </div>
  );
}

function BrainFallback() {
  return (
    <div className="absolute inset-0 bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,212,255,0.05)_0%,transparent_70%)]" />
    </div>
  );
}
