'use client';

import { useState, useCallback } from 'react';
import type { AIConfiguration } from '@/lib/ai/providers-config';
import { saveAIConfiguration, loadAIConfiguration } from '@/lib/ai/providers-config';

export interface WordPressConfiguration {
  siteUrl: string;
  jwtToken: string;
  writeMode: boolean;
}

export interface OnboardingState {
  currentStep: number;
  aiConfig: Partial<AIConfiguration>;
  wpConfig: Partial<WordPressConfiguration>;
  validations: {
    aiConfigValid: boolean;
    wpConfigValid: boolean;
  };
}

const INITIAL_STATE: OnboardingState = {
  currentStep: 1,
  aiConfig: {},
  wpConfig: {
    writeMode: false,
  },
  validations: {
    aiConfigValid: false,
    wpConfigValid: false,
  },
};

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);

  // Load existing configuration on mount
  const loadExistingConfig = useCallback(async () => {
    const existingAIConfig = await loadAIConfiguration();
    if (existingAIConfig) {
      setState(prev => ({
        ...prev,
        aiConfig: existingAIConfig,
        validations: {
          ...prev.validations,
          aiConfigValid: true,
        },
      }));
    }
  }, []);

  // AI Configuration
  const setProvider = useCallback((provider: string) => {
    setState(prev => ({
      ...prev,
      aiConfig: {
        ...prev.aiConfig,
        provider,
        apiKey: '', // Reset API key when provider changes
        model: '', // Reset model when provider changes
      },
      validations: {
        ...prev.validations,
        aiConfigValid: false,
      },
    }));
  }, []);

  const setApiKey = useCallback((apiKey: string) => {
    setState(prev => ({
      ...prev,
      aiConfig: {
        ...prev.aiConfig,
        apiKey,
      },
      validations: {
        ...prev.validations,
        aiConfigValid: false,
      },
    }));
  }, []);

  const setModel = useCallback((model: string) => {
    setState(prev => ({
      ...prev,
      aiConfig: {
        ...prev.aiConfig,
        model,
      },
      validations: {
        ...prev.validations,
        aiConfigValid: false,
      },
    }));
  }, []);

  const setAIConfigValid = useCallback((isValid: boolean) => {
    setState(prev => ({
      ...prev,
      validations: {
        ...prev.validations,
        aiConfigValid: isValid,
      },
    }));
  }, []);

  // WordPress Configuration
  const setSiteUrl = useCallback((siteUrl: string) => {
    setState(prev => ({
      ...prev,
      wpConfig: {
        ...prev.wpConfig,
        siteUrl,
      },
      validations: {
        ...prev.validations,
        wpConfigValid: false,
      },
    }));
  }, []);

  const setJwtToken = useCallback((jwtToken: string) => {
    setState(prev => ({
      ...prev,
      wpConfig: {
        ...prev.wpConfig,
        jwtToken,
      },
      validations: {
        ...prev.validations,
        wpConfigValid: false,
      },
    }));
  }, []);

  const setWriteMode = useCallback((writeMode: boolean) => {
    setState(prev => ({
      ...prev,
      wpConfig: {
        ...prev.wpConfig,
        writeMode,
      },
    }));
  }, []);

  const setWPConfigValid = useCallback((isValid: boolean) => {
    setState(prev => ({
      ...prev,
      validations: {
        ...prev.validations,
        wpConfigValid: isValid,
      },
    }));
  }, []);

  // Navigation
  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, 3),
    }));
  }, []);

  const previousStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, Math.min(step, 3)),
    }));
  }, []);

  // Validation helpers
  const canProceedFromStep1 = state.validations.aiConfigValid;
  const canProceedFromStep2 = state.validations.wpConfigValid;
  const isOnboardingComplete = canProceedFromStep1 && canProceedFromStep2;

  // Save configurations
  const saveAIConfig = useCallback(async () => {
    if (state.aiConfig.provider && state.aiConfig.apiKey && state.aiConfig.model) {
      const config: AIConfiguration = {
        provider: state.aiConfig.provider,
        apiKey: state.aiConfig.apiKey,
        model: state.aiConfig.model,
      };
      saveAIConfiguration(config);
    }
  }, [state.aiConfig]);

  const saveWPConfig = useCallback(async () => {
    if (state.wpConfig.siteUrl && state.wpConfig.jwtToken) {
      // Save WordPress configuration via API
      try {
        const response = await fetch('/api/mcp/connection/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            siteUrl: state.wpConfig.siteUrl,
            jwtToken: state.wpConfig.jwtToken,
            writeMode: state.wpConfig.writeMode,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save WordPress configuration');
        }
      } catch (error) {
        console.error('Failed to save WordPress configuration:', error);
        throw error;
      }
    }
  }, [state.wpConfig]);

  const completeOnboarding = useCallback(async () => {
    try {
      await saveAIConfig();
      await saveWPConfig();
      
      // Mark onboarding as completed in localStorage
      localStorage.setItem('onboarding-completed', 'true');
      
      return true;
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      return false;
    }
  }, [saveAIConfig, saveWPConfig]);

  // Skip onboarding
  const skipOnboarding = useCallback(() => {
    localStorage.setItem('onboarding-skipped', 'true');
  }, []);

  return {
    // State
    ...state,
    
    // AI Configuration
    setProvider,
    setApiKey,
    setModel,
    setAIConfigValid,
    
    // WordPress Configuration
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
    isOnboardingComplete,
    
    // Actions
    loadExistingConfig,
    saveAIConfig,
    saveWPConfig,
    completeOnboarding,
    skipOnboarding,
  };
}