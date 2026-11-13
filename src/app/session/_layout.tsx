import React from 'react';
import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { COLORS } from '@/constants/theme';

export default function SessionLayout() {
  useKeepAwake();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: COLORS.background },
        animation: 'fade',
      }}
    />
  );
}
