'use client';

import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export default function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  const baseClass = clsx(
    'inline-flex items-center rounded-[8px] border px-4 py-2 text-sm font-semibold transition focus:outline-none',
    variant === 'primary'
      ? 'bg-button text-button-text border-transparent hover:bg-[var(--color-button-hover)] focus:ring-4 focus:ring-[rgba(184,193,236,0.16)]'
      : 'bg-transparent text-paragraph border-[rgba(255,255,255,0.2)] hover:bg-[rgba(238,187,195,0.12)] focus:ring-4 focus:ring-[rgba(238,187,195,0.16)]',
    className
  );

  return (
    <button className={baseClass} {...props}>
      {children}
    </button>
  );
}
