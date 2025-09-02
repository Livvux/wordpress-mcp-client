'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { AI_PROVIDERS } from '@/lib/ai/providers-config';
import type { AIConfiguration } from '@/lib/ai/providers-config';

interface OnboardingCompleteProps {
  aiConfig: AIConfiguration;
  wordpressConfig: {
    siteUrl: string;
    writeMode: boolean;
  };
  onBeginChat: () => void;
}

// Confetti particle component
const ConfettiParticle = ({ delay }: { delay: number }) => (
  <motion.div
    className="absolute w-2 h-2 bg-primary rounded-full"
    initial={{
      opacity: 0,
      scale: 0,
      x: 0,
      y: 0,
    }}
    animate={{
      opacity: [0, 1, 0],
      scale: [0, 1, 0],
      x: Math.random() * 400 - 200,
      y: Math.random() * 300 - 150,
      rotate: Math.random() * 360,
    }}
    transition={{
      duration: 2,
      delay,
      ease: 'easeOut',
    }}
  />
);

// Party popper effect
const PartyEffect = () => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    setShowEffect(true);
    const timeout = setTimeout(() => setShowEffect(false), 3000);
    return () => clearTimeout(timeout);
  }, []);

  const confettiIds = useMemo(
    () =>
      Array.from({ length: 50 }, () =>
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      ),
    [],
  );

  if (!showEffect) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {confettiIds.map((id, i) => (
        <ConfettiParticle key={id} delay={i * 0.1} />
      ))}

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="text-6xl"
      >
        🎉
      </motion.div>
    </div>
  );
};

export function OnboardingComplete({
  aiConfig,
  wordpressConfig,
  onBeginChat,
}: OnboardingCompleteProps) {
  const [showContent, setShowContent] = useState(false);
  const provider = AI_PROVIDERS.find((p) => p.id === aiConfig.provider);
  const selectedModel = provider?.models.find((m) => m.id === aiConfig.model);

  useEffect(() => {
    const timeout = setTimeout(() => setShowContent(true), 1000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="space-y-6">
      <PartyEffect />

      <AnimatePresence>
        {showContent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', bounce: 0.5 }}
            >
              <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                <Sparkles className="h-8 w-8" />
                Setup Complete!
                <Sparkles className="h-8 w-8" />
              </h2>
              <p className="text-muted-foreground mt-2">
                Your wpAgent instance is ready to go!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-green-800 dark:text-green-200">
              Configuration Summary
            </CardTitle>
            <CardDescription className="text-green-600 dark:text-green-400">
              Here&apos;s what you&apos;ve set up:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-semibold">AI</span>
                  </div>
                  <div>
                    <div className="font-medium">AI Provider</div>
                    <div className="text-sm text-muted-foreground">
                      {provider?.name} • {selectedModel?.name}
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="bg-green-100 dark:bg-green-900"
                >
                  Connected
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-semibold">WP</span>
                  </div>
                  <div>
                    <div className="font-medium">WordPress Site</div>
                    <div className="text-sm text-muted-foreground">
                      {wordpressConfig.siteUrl}
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="bg-green-100 dark:bg-green-900"
                >
                  Connected
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-semibold">
                      {wordpressConfig.writeMode ? '✏️' : '👁️'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">Access Mode</div>
                    <div className="text-sm text-muted-foreground">
                      {wordpressConfig.writeMode
                        ? 'Write mode enabled'
                        : 'Read-only mode'}
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    wordpressConfig.writeMode
                      ? 'bg-yellow-100 dark:bg-yellow-900'
                      : 'bg-gray-100 dark:bg-gray-900'
                  }
                >
                  {wordpressConfig.writeMode ? 'Write' : 'Read Only'}
                </Badge>
              </div>
            </div>

            <div className="pt-4 border-t border-green-200 dark:border-green-800">
              <div className="space-y-2">
                <h4 className="font-medium text-green-800 dark:text-green-200">
                  What you can do now:
                </h4>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Chat with AI about your WordPress content</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Analyze posts, pages, and site data</span>
                  </li>
                  {wordpressConfig.writeMode && (
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Create and edit WordPress content with AI</span>
                    </li>
                  )}
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Get insights and recommendations for your site</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0.8 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="text-center"
      >
        <Button
          size="lg"
          onClick={onBeginChat}
          className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
        >
          Begin to Chat with Site
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <p className="text-sm text-muted-foreground mt-3">
          You can always change these settings later in your preferences
        </p>
      </motion.div>
    </div>
  );
}
