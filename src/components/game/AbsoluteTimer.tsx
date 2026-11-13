import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

interface AbsoluteTimerProps {
  durationSec: number;
  isRunning: boolean;
  onExpire: () => void;
  accentColor?: string;
  size?: 'compact' | 'large';
}

export function AbsoluteTimer({
  durationSec,
  isRunning,
  onExpire,
  accentColor = COLORS.primary,
  size = 'compact',
}: AbsoluteTimerProps) {
  const totalMs = durationSec * 1000;
  const endTimestampRef = useRef<number | null>(null);
  const remainingMsRef = useRef<number>(totalMs);
  const hasExpiredRef = useRef<boolean>(false);
  const lastHapticSecondRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const [displaySeconds, setDisplaySeconds] = useState<number>(durationSec);
  const [progressFraction, setProgressFraction] = useState<number>(1);

  useEffect(() => {
    remainingMsRef.current = durationSec * 1000;
    endTimestampRef.current = isRunning ? Date.now() + durationSec * 1000 : null;
    hasExpiredRef.current = false;
    lastHapticSecondRef.current = null;
    setDisplaySeconds(durationSec);
    setProgressFraction(1);
  }, [durationSec]);

  const syncRemainingTime = useCallback(() => {
    if (endTimestampRef.current === null) {
      return;
    }

    const diffMs = Math.max(0, endTimestampRef.current - Date.now());
    remainingMsRef.current = diffMs;

    const secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));
    const fraction = totalMs > 0 ? Math.max(0, Math.min(1, diffMs / totalMs)) : 0;

    setDisplaySeconds(secondsLeft);
    setProgressFraction(fraction);

    if (secondsLeft <= 5 && secondsLeft > 0) {
      if (lastHapticSecondRef.current !== secondsLeft) {
        lastHapticSecondRef.current = secondsLeft;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }

    if (diffMs <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      endTimestampRef.current = null;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onExpireRef.current();
    }
  }, [totalMs]);

  useEffect(() => {
    if (hasExpiredRef.current) {
      return;
    }

    if (isRunning) {
      endTimestampRef.current = Date.now() + remainingMsRef.current;
      syncRemainingTime();

      const intervalId = setInterval(() => {
        syncRemainingTime();
      }, 200);

      return () => clearInterval(intervalId);
    } else {
      if (endTimestampRef.current !== null) {
        remainingMsRef.current = Math.max(0, endTimestampRef.current - Date.now());
        endTimestampRef.current = null;
      }
    }
  }, [isRunning, syncRemainingTime]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active' && isRunning && !hasExpiredRef.current) {
          syncRemainingTime();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [isRunning, syncRemainingTime]);

  const isCritical = displaySeconds <= 5;
  const activeColor = isCritical ? COLORS.spy : accentColor;

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Text
        style={[
          size === 'large' ? styles.timeTextLarge : styles.timeTextCompact,
          isCritical && { color: COLORS.spy },
        ]}
      >
        {formattedTime}
      </Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(progressFraction * 100)}%`,
              backgroundColor: activeColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: SPACING.sm,
  },
  timeTextCompact: {
    color: COLORS.textPrimary,
    fontSize: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  timeTextLarge: {
    color: COLORS.textPrimary,
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
});
