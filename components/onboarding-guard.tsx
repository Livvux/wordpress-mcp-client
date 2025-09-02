'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  useEffect(() => {
    // Admin-only configuration: disable client onboarding flow entirely
    setShouldShowOnboarding(false);
    setIsChecking(false);
  }, [router]);

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-muted rounded mx-auto mb-2" />
            <div className="h-4 w-48 bg-muted rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // If onboarding is needed, show a brief loading message before redirect
  if (shouldShowOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Setting up wpAgent...</h2>
          <p className="text-muted-foreground">Redirecting to setup wizard</p>
        </div>
      </div>
    );
  }

  // Show main application if onboarding is complete
  return <>{children}</>;
}
