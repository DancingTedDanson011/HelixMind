import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-lg border bg-surface px-4 py-2.5 text-sm text-white',
            'placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30',
            'transition-all duration-200',
            error
              ? 'border-error/50 focus:ring-error/50'
              : 'border-white/10 hover:border-white/20',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
