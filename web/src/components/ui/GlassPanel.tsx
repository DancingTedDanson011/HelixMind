import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  intensity?: 'subtle' | 'default' | 'strong';
  glow?: boolean;
}

const intensityStyles = {
  subtle: 'glass-subtle',
  default: 'glass',
  strong: 'glass-strong',
};

export function GlassPanel({
  className,
  intensity = 'default',
  glow = false,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-6',
        intensityStyles[intensity],
        glow && 'glow-primary',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
