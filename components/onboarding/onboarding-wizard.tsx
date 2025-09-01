'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOnboardingState } from '@/hooks/use-onboarding-state';
import { ApiSetup } from './steps/api-setup';
import { WordPressSetup } from './steps/wordpress-setup';
import { OnboardingComplete } from './steps/onboarding-complete';

const STEPS = [
  {
    id: 1,
    title: 'AI Provider',
    description: 'Configure your AI provider and API key',
  },
  {
    id: 2,
    title: 'WordPress',
    description: 'Connect to your WordPress site',
  },
  {
    id: 3,
    title: 'Complete',
    description: 'You are all set!',
  },
];

interface OnboardingWizardProps {
  allowSkip?: boolean;
}

export function OnboardingWizard({ allowSkip = true }: OnboardingWizardProps) {
  const router = useRouter();
  const {
    currentStep,
    aiConfig,
    wpConfig,
    validations,
    
    // AI Config
    setProvider,
    setApiKey,
    setModel,
    setAIConfigValid,
    
    // WP Config
    setSiteUrl,
    setJwtToken,
    setWriteMode,
    setWPConfigValid,
    
    // Navigation
    nextStep,
    previousStep,
    goToStep,
    
    // Validation
    canProceedFromStep1,
    canProceedFromStep2,
    
    // Actions
    loadExistingConfig,
    completeOnboarding,
    skipOnboarding,
  } = useOnboardingState();

  useEffect(() => {
    loadExistingConfig();
  }, [loadExistingConfig]);

  const handleNext = () => {
    if (currentStep === 1 && canProceedFromStep1) {
      nextStep();
      window.scrollTo(0, 0);
    } else if (currentStep === 2 && canProceedFromStep2) {
      nextStep();
      window.scrollTo(0, 0);
    }
  };

  const handleSkip = () => {
    skipOnboarding();
    router.push('/');
  };

  const handleComplete = async () => {
    try {
      await completeOnboarding();
      router.push('/');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // You might want to show an error message here
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return canProceedFromStep1;
      case 2:
        return canProceedFromStep2;
      default:
        return false;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold">wpAgentic Setup</h1>
            </div>
            {allowSkip && currentStep < 3 && (
              <Button variant="ghost" onClick={handleSkip}>
                <X className="h-4 w-4 mr-2" />
                Skip Setup
              </Button>
            )}
          </div>

          {/* Progress indicator */}
          <div className="space-y-4">
            <div className="flex justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center space-x-2"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-blue-600 text-white">
                    {currentStep}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">{STEPS[currentStep - 1].title}</div>
                    <div className="text-xs text-muted-foreground">
                      {STEPS[currentStep - 1].description}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            
            <div className="max-w-md mx-auto">
              <Progress value={progress} className="h-1 [&>div]:bg-blue-600" />
              <div className="text-sm text-muted-foreground mt-2">
                Step {currentStep} of {STEPS.length}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentStep === 1 && (
                <ApiSetup
                  selectedProvider={aiConfig.provider || null}
                  apiKey={aiConfig.apiKey || ''}
                  selectedModel={aiConfig.model || null}
                  onProviderChange={setProvider}
                  onApiKeyChange={setApiKey}
                  onModelChange={setModel}
                  onValidationChange={setAIConfigValid}
                />
              )}
              
              {currentStep === 2 && (
                <WordPressSetup
                  siteUrl={wpConfig.siteUrl || ''}
                  jwtToken={wpConfig.jwtToken || ''}
                  writeMode={wpConfig.writeMode || false}
                  onSiteUrlChange={setSiteUrl}
                  onJwtTokenChange={setJwtToken}
                  onWriteModeChange={setWriteMode}
                  onValidationChange={setWPConfigValid}
                />
              )}
              
              {currentStep === 3 && aiConfig.provider && aiConfig.model && wpConfig.siteUrl && (
                <OnboardingComplete
                  aiConfig={{
                    provider: aiConfig.provider,
                    apiKey: aiConfig.apiKey || '',
                    model: aiConfig.model,
                  }}
                  wordpressConfig={{
                    siteUrl: wpConfig.siteUrl,
                    writeMode: wpConfig.writeMode || false,
                  }}
                  onBeginChat={handleComplete}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        {currentStep < 3 && (
          <div className="max-w-4xl mx-auto mt-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={previousStep}
                    disabled={currentStep === 1}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  
                  <div className="flex space-x-2">
                    {allowSkip && (
                      <Button variant="ghost" onClick={handleSkip}>
                        Skip for now
                      </Button>
                    )}
                    <Button
                      onClick={handleNext}
                      disabled={!canProceed()}
                    >
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
