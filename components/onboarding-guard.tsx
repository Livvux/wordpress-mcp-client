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
    const checkOnboardingStatus = () => {
      try {
        // Check if onboarding was completed or skipped (use localStorage for persistent flags)
        const isCompleted =
          localStorage.getItem('onboarding-completed') === 'true';
        const isSkipped = localStorage.getItem('onboarding-skipped') === 'true';

        // Check if AI configuration exists in sessionStorage (primary) or localStorage (migration)
        const hasSessionConfig = sessionStorage.getItem('ai-config') !== null;
        const hasLocalConfig = localStorage.getItem('ai-config') !== null;
        const hasAIConfig = hasSessionConfig || hasLocalConfig;

        const needsOnboarding = !isCompleted && !isSkipped && !hasAIConfig;

        if (needsOnboarding) {
          setShouldShowOnboarding(true);
          // Redirect to onboarding after a brief moment to avoid flash
          setTimeout(() => {
            router.push('/setup');
          }, 100);
        } else {
          setShouldShowOnboarding(false);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // If there's an error accessing localStorage, assume onboarding is needed
        setShouldShowOnboarding(true);
        setTimeout(() => {
          router.push('/setup');
        }, 100);
      } finally {
        setIsChecking(false);
      }
    };

    // Run check after component mounts
    checkOnboardingStatus();
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
          <h2 className="text-lg font-semibold">Setting up wpAgentic...</h2>
          <p className="text-muted-foreground">Redirecting to setup wizard</p>
        </div>
      </div>
    );
  }

  // Show main application if onboarding is complete
  return <>{children}</>;
}
