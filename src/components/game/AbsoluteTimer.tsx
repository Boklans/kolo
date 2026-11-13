import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { playRoundEndBuzzer, playTimerTick } from '@/utils/sound';

interface AbsoluteTimerProps {
  durationSec: number;
  isRunning: boolean;
  onExpire: () => void;
  accentColor?: string;
  size?: 'compact' | 'large' | 'hero';
  onSecondChange?: (secondsLeft: number) => void;
}

export function AbsoluteTimer({
  durationSec,
  isRunning,
  onExpire,
  accentColor = COLORS.primary,
  size = 'compact',
  onSecondChange,
}: AbsoluteTimerProps) {
  const totalMs = durationSec * 1000;
  const endTimestampRef = useRef<number | null>(null);
  const remainingMsRef = useRef<number>(totalMs);
  const hasExpiredRef = useRef<boolean>(false);
  const lastNotifiedSecondRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  const onSecondChangeRef = useRef(onSecondChange);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    onSecondChangeRef.current = onSecondChange;
  }, [onSecondChange]);

  const [displaySeconds, setDisplaySeconds] = useState<number>(durationSec);
  const [progressFraction, setProgressFraction] = useState<number>(1);

  const pulseScale = useSharedValue(1);
  const barGlowOpacity = useSharedValue(1);

  useEffect(() => {
    remainingMsRef.current = durationSec * 1000;
    endTimestampRef.current = isRunning ? Date.now() + durationSec * 1000 : null;
    hasExpiredRef.current = false;
    lastNotifiedSecondRef.current = null;
    setDisplaySeconds(durationSec);
    setProgressFraction(1);
    pulseScale.value = 1;
    barGlowOpacity.value = 1;
  }, [durationSec, pulseScale, barGlowOpacity]);

  const triggerTickAnimation = useCallback(
    (secondsLeft: number) => {
      if (secondsLeft <= 10 && secondsLeft > 0) {
        const peakScale = secondsLeft <= 5 ? 1.14 : 1.08;
        pulseScale.value = withSequence(
          withTiming(peakScale, { duration: 110 }),
          withSpring(1, { damping: 12, stiffness: 220 })
        );
        barGlowOpacity.value = withSequence(
          withTiming(0.55, { duration: 110 }),
          withTiming(1, { duration: 240 })
        );
      } else if (secondsLeft <= 20 && secondsLeft > 10) {
        pulseScale.value = withSequence(
          withTiming(1.03, { duration: 90 }),
          withTiming(1, { duration: 160 })
        );
      }
    },
    [pulseScale, barGlowOpacity]
  );

  const syncRemainingTime = useCallback(() => {
    if (endTimestampRef.current === null) {
      return;
    }

    const diffMs = Math.max(0, endTimestampRef.current - Date.now());
    remainingMsRef.current = diffMs;

    const secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));
    const fraction =
      totalMs > 0 ? Math.max(0, Math.min(1, diffMs / totalMs)) : 0;

    setDisplaySeconds(secondsLeft);
    setProgressFraction(fraction);

    if (lastNotifiedSecondRef.current !== secondsLeft) {
      lastNotifiedSecondRef.current = secondsLeft;
      onSecondChangeRef.current?.(secondsLeft);
      triggerTickAnimation(secondsLeft);

      if (secondsLeft === 20 || secondsLeft === 15) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        playTimerTick('warning');
      } else if (secondsLeft <= 10 && secondsLeft > 5) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        playTimerTick('warning');
      } else if (secondsLeft <= 5 && secondsLeft > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        playTimerTick('critical');
      }
    }

    if (diffMs <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      endTimestampRef.current = null;
      playRoundEndBuzzer();
      onExpireRef.current();
    }
  }, [totalMs, triggerTickAnimation]);

  useEffect(() => {
    if (hasExpiredRef.current) {
      return;
    }

    if (isRunning) {
      endTimestampRef.current = Date.now() + remainingMsRef.current;
      syncRemainingTime();

      const intervalId = setInterval(() => {
        syncRemainingTime();
      }, 100);

      return () => clearInterval(intervalId);
    } else {
      if (endTimestampRef.current !== null) {
        remainingMsRef.current = Math.max(
          0,
          endTimestampRef.current - Date.now()
        );
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

  const timerState: 'calm' | 'warning' | 'critical' =
    displaySeconds <= 10
      ? 'critical'
      : displaySeconds <= 20
        ? 'warning'
        : 'calm';

  const activeColor =
    timerState === 'critical'
      ? COLORS.spy
      : timerState === 'warning'
        ? COLORS.hot
        : accentColor;

  const stateLabel =
    timerState === 'critical'
      ? 'ФІНАЛЬНІ СЕКУНДИ!'
      : timerState === 'warning'
        ? 'ПРИСКОРЮЙСЯ'
        : 'ЧАС РАУНДУ';

  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const animatedTextStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const animatedBarStyle = useAnimatedStyle(() => ({
    opacity: barGlowOpacity.value,
  }));

  if (size === 'hero') {
    return (
      <View
        style={[
          styles.heroContainer,
          timerState === 'critical' && styles.heroContainerCritical,
          timerState === 'warning' && styles.heroContainerWarning,
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroStateBadge}>
            <View
              style={[styles.heroStateDot, { backgroundColor: activeColor }]}
            />
            <Text style={[styles.heroStateText, { color: activeColor }]}>
              {stateLabel}
            </Text>
          </View>

          <Animated.Text
            style={[
              styles.timeTextHero,
              timerState === 'warning' && { color: COLORS.hot },
              timerState === 'critical' && { color: COLORS.spy },
              animatedTextStyle,
            ]}
          >
            {formattedTime}
          </Animated.Text>
        </View>

        <View style={styles.progressTrackHero}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(progressFraction * 100)}%`,
                backgroundColor: activeColor,
              },
              animatedBarStyle,
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          size === 'large' ? styles.timeTextLarge : styles.timeTextCompact,
          timerState === 'warning' && { color: COLORS.hot },
          timerState === 'critical' && { color: COLORS.spy },
          animatedTextStyle,
        ]}
      >
        {formattedTime}
      </Animated.Text>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(progressFraction * 100)}%`,
              backgroundColor: activeColor,
            },
            animatedBarStyle,
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
  heroContainer: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    gap: 10,
  },
  heroContainerWarning: {
    backgroundColor: '#231915',
  },
  heroContainerCritical: {
    backgroundColor: '#261319',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroStateDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
  },
  heroStateText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  timeTextHero: {
    color: COLORS.textPrimary,
    fontSize: 38,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.2,
  },
  progressTrackHero: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
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
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
});
