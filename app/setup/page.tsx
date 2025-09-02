import type { Metadata } from 'next';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export const metadata: Metadata = {
  title: 'Setup - wpAgent',
  description:
    'Set up your wpAgent instance with AI provider and WordPress connection',
};

export default function SetupPage() {
  return <OnboardingWizard allowSkip={true} />;
}
