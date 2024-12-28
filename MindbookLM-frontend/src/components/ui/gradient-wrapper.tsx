import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function GradientWrapper({
  children,
  direction = 'right',
  from = 'purple-500',
  to = 'pink-500',
  className,
}: {
  children: React.ReactNode;
  direction?: 'right' | 'left';
  from?: string;
  to?: string;
  className?: string;
}) {
  return (
    <div className={cn('group relative', className)}>
      <div className={cn(
        'absolute -inset-1',
        `bg-gradient-to-${direction}`,
        `from-${from}`,
        `to-${to}`,
        'rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity'
      )} />
      {children}
    </div>
  );
}