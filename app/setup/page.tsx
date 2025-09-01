import type { Metadata } from 'next';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export const metadata: Metadata = {
  title: 'Setup - wpAgentic',
  description:
    'Set up your wpAgentic instance with AI provider and WordPress connection',
};

export default function SetupPage() {
  return <OnboardingWizard allowSkip={true} />;
}
