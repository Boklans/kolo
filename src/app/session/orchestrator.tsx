import React from 'react';
import { Redirect } from 'expo-router';
import { usePartyStore } from '@/stores/usePartyStore';
import ScoreboardScreen from './scoreboard';

export default function SessionOrchestratorScreen() {
  const isActive = usePartyStore((s) => s.isActive);
  const isCompleted = usePartyStore((s) => s.isCompleted);
  const steps = usePartyStore((s) => s.steps);
  const currentStepIndex = usePartyStore((s) => s.currentStepIndex);

  if (!isActive || steps.length === 0) {
    return <Redirect href="/" />;
  }

  if (isCompleted) {
    return <ScoreboardScreen />;
  }

  const currentStep = steps[currentStepIndex];
  if (!currentStep) {
    return <ScoreboardScreen />;
  }

  if (currentStep.gameType === 'alias') {
    return <Redirect href="/session/alias" />;
  }

  if (currentStep.gameType === 'crocodile') {
    return <Redirect href="/session/crocodile" />;
  }

  if (currentStep.gameType === 'spy') {
    return <Redirect href="/session/spy" />;
  }

  if (currentStep.gameType === 'taboo') {
    return <Redirect href="/session/taboo" />;
  }

  return <Redirect href="/" />;
}
