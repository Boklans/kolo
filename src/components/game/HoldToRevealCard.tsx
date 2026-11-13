import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Fingerprint } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

interface HoldToRevealCardProps {
  playerNumber: number;
  isSpy: boolean;
  locationName: string;
  roleName?: string;
  hasSeenRole: boolean;
  onRevealedEnough: () => void;
}

const HOLD_THRESHOLD_MS = 600;

export function HoldToRevealCard({
  playerNumber,
  isSpy,
  locationName,
  roleName,
  hasSeenRole,
  onRevealedEnough,
}: HoldToRevealCardProps) {
  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealAnim = useSharedValue(0);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, [playerNumber]);

  const handlePressIn = () => {
    setIsHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    revealAnim.value = withTiming(1, { duration: 140 });

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }

    holdTimerRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onRevealedEnough();
    }, HOLD_THRESHOLD_MS);
  };

  const handlePressOut = () => {
    setIsHolding(false);
    // Миттєве приховування за 100 мс
    revealAnim.value = withTiming(0, { duration: 100 });

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const secretContentStyle = useAnimatedStyle(() => ({
    opacity: revealAnim.value,
    transform: [{ scale: 0.97 + revealAnim.value * 0.03 }],
  }));

  const coverStyle = useAnimatedStyle(() => ({
    opacity: 1 - revealAnim.value,
  }));

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressableWrap}
    >
      <View
        style={[
          styles.cardContainer,
          isHolding &&
            (isSpy ? styles.cardContainerSpy : styles.cardContainerCitizen),
        ]}
      >
        {/* Secret Role Layer */}
        <Animated.View
          style={[styles.secretLayer, secretContentStyle]}
          pointerEvents="none"
        >
          {isSpy ? (
            <View style={styles.roleInner}>
              <Text style={[styles.roleOverline, { color: COLORS.spy }]}>
                СЕКРЕТНИЙ СТАТУС
              </Text>
              <Text style={[styles.roleHeadline, { color: COLORS.spy }]}>
                Ти Шпигун
              </Text>
              <Text style={styles.roleDescription}>
                Не видай себе. Слухай запитання інших гравців і спробуй зрозуміти, у якій ви локації.
              </Text>
            </View>
          ) : (
            <View style={styles.roleInner}>
              <Text style={styles.roleOverline}>ЛОКАЦІЯ</Text>
              <Text style={styles.locationTitle}>{locationName}</Text>
              {roleName ? (
                <Text style={styles.roleTag}>Твоя роль: {roleName}</Text>
              ) : null}
              <Text style={styles.roleDescription}>
                Став запитання іншим, щоб викрити шпигуна, але не називай локацію прямо.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Concealed Curtain Layer */}
        <Animated.View
          style={[styles.coverLayer, coverStyle]}
          pointerEvents="none"
        >
          <View style={styles.targetRing}>
            <Fingerprint
              size={36}
              color={hasSeenRole ? COLORS.textSecondary : COLORS.spy}
            />
          </View>

          <Text style={styles.coverTitle}>Утримуй, щоб відкрити роль</Text>
          <Text style={styles.coverSub}>
            {hasSeenRole
              ? 'Роль переглянуто — передай телефон далі'
              : 'Переконайся, що ніхто не заглядає в екран'}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableWrap: {
    width: '100%',
    flex: 1,
    maxHeight: 380,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainerSpy: {
    backgroundColor: '#241319',
  },
  cardContainerCitizen: {
    backgroundColor: COLORS.surfaceElevated,
  },
  secretLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  targetRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  coverTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  coverSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  roleInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: SPACING.sm,
  },
  roleOverline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  roleHeadline: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  locationTitle: {
    color: COLORS.textPrimary,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
    textAlign: 'center',
    lineHeight: 36,
  },
  roleTag: {
    color: COLORS.crocodile,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  roleDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});
