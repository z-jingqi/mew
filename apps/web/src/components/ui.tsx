import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button as ShadcnButton } from './ui/button';
import { cn } from '@/lib/utils';

export { Card } from './ui/card';
export { Input } from './ui/input';

type LegacyVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_MAP = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
} as const;

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: LegacyVariant }) {
  return <ShadcnButton variant={VARIANT_MAP[variant]} className={className} {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Chip({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      )}
    >
      {children}
    </button>
  );
}
