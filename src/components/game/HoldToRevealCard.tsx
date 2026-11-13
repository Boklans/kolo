import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, Fingerprint } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { playRoleRevealLock } from '@/utils/sound';

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
  const scanProgressAnim = useSharedValue(0);

  useEffect(() => {
    scanProgressAnim.value = 0;
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, [playerNumber, scanProgressAnim]);

  const handlePressIn = () => {
    setIsHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    revealAnim.value = withTiming(1, { duration: 140 });
    scanProgressAnim.value = 0;
    scanProgressAnim.value = withTiming(1, { duration: HOLD_THRESHOLD_MS });

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }

    holdTimerRef.current = setTimeout(() => {
      playRoleRevealLock(isSpy);
      onRevealedEnough();
    }, HOLD_THRESHOLD_MS);
  };

  const handlePressOut = () => {
    setIsHolding(false);
    // Миттєве приховування за 100 мс
    revealAnim.value = withTiming(0, { duration: 100 });
    scanProgressAnim.value = withTiming(0, { duration: 120 });

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const secretContentStyle = useAnimatedStyle(() => ({
    opacity: revealAnim.value,
    transform: [{ scale: 0.96 + revealAnim.value * 0.04 }],
  }));

  const coverStyle = useAnimatedStyle(() => ({
    opacity: 1 - revealAnim.value,
  }));

  const scanBarStyle = useAnimatedStyle(() => ({
    width: `${Math.round(scanProgressAnim.value * 100)}%`,
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
              <View style={styles.classifiedBadgeSpy}>
                <Text style={styles.classifiedBadgeSpyText}>
                  ЦІЛКОМ ТАЄМНО · САМОЗВАНЕЦЬ
                </Text>
              </View>
              <Text style={[styles.roleHeadline, { color: COLORS.spy }]}>
                ТИ ШПИГУН!
              </Text>
              <Text style={styles.roleDescription}>
                Не видай себе. Слухай запитання інших гравців і спробуй
                вирахувати секретну локацію.
              </Text>
            </View>
          ) : (
            <View style={styles.roleInner}>
              <View style={styles.classifiedBadgeCitizen}>
                <Text style={styles.classifiedBadgeCitizenText}>
                  ДОСТУП НАДАНО · ЛОКАЦІЯ
                </Text>
              </View>
              <Text style={styles.locationTitle}>{locationName}</Text>
              {roleName ? (
                <Text style={styles.roleTag}>Твоя легенда: {roleName}</Text>
              ) : null}
              <Text style={styles.roleDescription}>
                Став хитрі запитання іншим, щоб викрити шпигуна, але не називай
                локацію прямо.
              </Text>
            </View>
          )}

          {/* Hold progress indicator at bottom of secret card */}
          <View style={styles.scanTrack}>
            <Animated.View
              style={[
                styles.scanFill,
                { backgroundColor: isSpy ? COLORS.spy : COLORS.crocodile },
                scanBarStyle,
              ]}
            />
          </View>
        </Animated.View>

        {/* Concealed Curtain Layer */}
        <Animated.View
          style={[styles.coverLayer, coverStyle]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.targetRing,
              hasSeenRole && styles.targetRingSeen,
            ]}
          >
            {hasSeenRole ? (
              <CheckCircle2 size={36} color={COLORS.crocodile} />
            ) : (
              <Fingerprint size={38} color={COLORS.spy} />
            )}
          </View>

          <Text style={styles.coverOverline}>
            {hasSeenRole ? 'ДОСЬЄ ПЕРЕВІРЕНО' : 'СЕКРЕТНЕ ДОСЬЄ'}
          </Text>
          <Text style={styles.coverTitle}>
            {hasSeenRole
              ? 'Роль відкрито — передай телефон'
              : 'Утримуй палець на сканері'}
          </Text>
          <Text style={styles.coverSub}>
            {hasSeenRole
              ? 'Можеш утримати ще раз, якщо забув роль'
              : 'Переконайся, що сусіди за столом не бачать екран'}
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
    maxHeight: 390,
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
    backgroundColor: '#261118',
  },
  cardContainerCitizen: {
    backgroundColor: '#17222B',
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
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: `${COLORS.spy}1C`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  targetRingSeen: {
    backgroundColor: `${COLORS.crocodile}1E`,
  },
  coverOverline: {
    color: COLORS.spy,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  coverTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
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
    gap: 10,
  },
  classifiedBadgeSpy: {
    backgroundColor: `${COLORS.spy}28`,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  classifiedBadgeSpyText: {
    color: COLORS.spy,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  classifiedBadgeCitizen: {
    backgroundColor: `${COLORS.crocodile}24`,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  classifiedBadgeCitizenText: {
    color: COLORS.crocodile,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  roleHeadline: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  locationTitle: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
    lineHeight: 38,
  },
  roleTag: {
    color: COLORS.crocodile,
    fontSize: 15,
    fontWeight: '700',
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
  scanTrack: {
    position: 'absolute',
    left: SPACING.xxl,
    right: SPACING.xxl,
    bottom: SPACING.xl,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  scanFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
});
