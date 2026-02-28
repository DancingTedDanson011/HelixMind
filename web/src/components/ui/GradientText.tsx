import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

interface GradientTextProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'glow';
}

export function GradientText({ className, variant = 'brand', children, ...props }: GradientTextProps) {
  return (
    <span
      className={cn(
        variant === 'brand' ? 'gradient-text' : 'gradient-text-glow',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
