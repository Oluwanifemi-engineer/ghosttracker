'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

/**
 * Card Component
 *
 * Design pattern: Compound Component
 * - Consistent card styling across the app
 * - Variants for different use cases
 * - Composable with Card.Header, Card.Body, Card.Footer
 *
 * Usage:
 * ```
 * <Card variant="default">
 *   <Card.Header>Title</Card.Header>
 *   <Card.Body>Content</Card.Body>
 *   <Card.Footer>Actions</Card.Footer>
 * </Card>
 * ```
 */

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'interactive' | 'danger' | 'success';
  className?: string;
  onClick?: () => void;
}

function Card({ children, variant = 'default', className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        // Base styles
        'rounded-xl border transition-all duration-200',
        // Variants
        {
          'bg-gray-800/50 border-gray-700/50': variant === 'default',
          'bg-gray-800/50 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600/50 cursor-pointer': variant === 'interactive',
          'bg-red-900/20 border-red-800/50': variant === 'danger',
          'bg-green-900/20 border-green-800/50': variant === 'success',
        },
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-3 border-b border-gray-700/50', className)}>
      {children}
    </div>
  );
}

function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-3', className)}>
      {children}
    </div>
  );
}

function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-4 py-3 border-t border-gray-700/50', className)}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export { Card };
