'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]',
  secondary:
    'bg-secondary/10 border-secondary/30 text-secondary hover:bg-secondary/20 hover:border-secondary/50',
  ghost:
    'bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white',
  outline:
    'bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:border-white/20',
  danger:
    'bg-error/10 border-error/30 text-error hover:bg-error/20 hover:border-error/50',
};

const sizeStyles: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-md',
  md: 'text-sm px-5 py-2.5 rounded-lg',
  lg: 'text-base px-7 py-3.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 border font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
