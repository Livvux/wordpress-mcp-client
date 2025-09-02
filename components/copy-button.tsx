'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type CopyButtonProps = {
  text: string;
  children?: React.ReactNode;
  variant?:
    | 'default'
    | 'outline'
    | 'ghost'
    | 'link'
    | 'secondary'
    | 'destructive';
};

export function CopyButton({
  text,
  children = 'Copy',
  variant = 'default',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // reset state after a short delay
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op: clipboard may be unavailable; keep silent
    }
  }

  return (
    <Button variant={variant} onClick={handleClick}>
      {copied ? 'Copied' : children}
    </Button>
  );
}
