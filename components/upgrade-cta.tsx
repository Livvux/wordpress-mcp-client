'use client';

import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Check, Crown, Rocket, Shield, Sparkles, Zap } from 'lucide-react';

type BillingStatus = {
  ok: boolean;
  userType: 'guest' | 'regular';
  hasActiveSubscription: boolean;
  plan: 'free' | 'pro';
  trialUntil: string | null;
  trialExpired: boolean;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PriceInfo = {
  id: string;
  currency: string;
  amount: number | null; // cents
  interval: 'day' | 'week' | 'month' | 'year';
  intervalCount: number;
};

type PricesResponse = {
  ok: boolean;
  monthly?: PriceInfo | null;
  yearly?: PriceInfo | null;
};

function formatAmount(amountCents: number | null | undefined, currency: string | undefined) {
  if (typeof amountCents !== 'number' || !currency) return '—';
  const curr = currency.toUpperCase();
  const value = amountCents / 100;

  try {
    if (curr === 'USD') {
      // Force $ before the amount
      const num = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(value);
      return `$${num}`;
    }

    if (curr === 'EUR') {
      // Show amount followed by € (German style)
      const num = new Intl.NumberFormat('de-DE', {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(value);
      return `${num} €`;
    }

    // Fallback: locale currency formatting
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toFixed(0)} ${curr}`;
  }
}

export function UpgradeCTA({
  className = '',
  variant = 'card',
}: {
  className?: string;
  variant?: 'card' | 'minimal';
}) {
  const t = useTranslations();
  const { data } = useSWR<BillingStatus>('/api/billing/status', fetcher);
  const { data: prices } = useSWR<PricesResponse>('/api/billing/prices', fetcher);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const plan = data?.plan ?? 'free';
  const isPro = plan === 'pro' && data?.hasActiveSubscription;
  const isGuest = (data?.userType ?? 'guest') === 'guest';

  // Hide CTA for Pro users and guests
  if (isPro || isGuest) return null;

  const PlanDialogContent = () => (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-amber-500 drop-shadow-sm" /> {t('upgrade')}
        </DialogTitle>
        <DialogDescription>
          {t('customize')}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {/* Highlights */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Check className="h-6 w-6 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-sm font-medium">{t('unlimited_sites')}</div>
              <div className="text-xs text-muted-foreground">
                Connect and manage as many WordPress installs as you need.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Sparkles className="h-6 w-6 mt-0.5 text-violet-600 dark:text-violet-400" />
            <div>
              <div className="text-sm font-medium">{t('write_mode')}</div>
              <div className="text-xs text-muted-foreground">
                {t('write_mode_desc')}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Zap className="h-6 w-6 mt-0.5 text-sky-600 dark:text-sky-400" />
            <div>
              <div className="text-sm font-medium">{t('advanced_tools')}</div>
              <div className="text-xs text-muted-foreground">
                {t('advanced_tools_desc')}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Rocket className="h-6 w-6 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <div className="text-sm font-medium">{t('priority_compute')}</div>
              <div className="text-xs text-muted-foreground">
                {t('priority_compute_desc')}
              </div>
            </div>
          </div>
        </div>

        {/* Plan selection */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="default"
            onClick={() => {
              setOpen(false);
              router.push('/upgrade');
            }}
            className="h-auto justify-start gap-2 px-4 py-3 text-left bg-black text-white hover:bg-black/90 dark:bg-black dark:text-white shadow-sm"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{t('pro_monthly')}</span>
              <span className="text-xs opacity-80">
                {formatAmount(prices?.monthly?.amount ?? null, prices?.monthly?.currency)}
                /mo
              </span>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              router.push('/upgrade?interval=yearly');
            }}
            className="relative h-auto justify-start gap-2 px-4 py-3 text-left shadow-sm"
          >
            <span className="absolute right-2 top-2 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
              {(() => {
                const m = prices?.monthly?.amount;
                const y = prices?.yearly?.amount;
                if (typeof m === 'number' && typeof y === 'number' && m > 0) {
                  const monthsEquivalent = y / m;
                  const savedMonths = Math.round(12 - monthsEquivalent);
                  if (savedMonths > 0 && savedMonths <= 11) return `Save ${savedMonths} months`;
                }
                return 'Best value';
              })()}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{t('pro_annual')}</span>
              <span className="text-xs opacity-80">
                {formatAmount(prices?.yearly?.amount ?? null, prices?.yearly?.currency)}
                /yr
              </span>
              {prices?.monthly?.amount && prices?.yearly?.amount ? (
                <span className="text-[10px] text-muted-foreground">
                  ≈
                  {formatAmount(
                    Math.round((prices.yearly.amount / 12) as number),
                    prices.yearly.currency,
                  )}
                  /mo
                </span>
              ) : null}
            </div>
          </Button>
        </div>

        {/* Assurance */}
        <div className="flex items-center gap-2 rounded-md border p-3 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
          <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          {t('assurance')}
        </div>
      </div>
    </DialogContent>
  );

  if (variant === 'minimal') {
    return (
      <div className={className}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="default" className="h-7">
              Upgrade to Pro
            </Button>
          </DialogTrigger>
          <PlanDialogContent />
        </Dialog>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">Upgrade to Pro</div>
          <div className="text-xs text-muted-foreground">
            Unlock unlimited sites, write mode, and advanced tools.
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <div className="flex items-center gap-2">
              <DialogTrigger asChild>
                <Button size="sm" className="h-7">Choose plan</Button>
              </DialogTrigger>
              <div className="text-xs text-muted-foreground">
                {formatAmount(prices?.monthly?.amount ?? null, prices?.monthly?.currency)}
                /mo ·
                {formatAmount(prices?.yearly?.amount ?? null, prices?.yearly?.currency)}
                /yr
              </div>
            </div>
            <PlanDialogContent />
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
