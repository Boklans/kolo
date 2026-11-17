import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CheckCircle2, Fingerprint } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { playRoleRevealLock, triggerHaptic } from '@/utils/sound';

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
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setIsHolding(false);
    revealAnim.value = 0;
    scanProgressAnim.value = 0;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [playerNumber, revealAnim, scanProgressAnim]);

  const handlePressIn = () => {
    setIsHolding(true);
    triggerHaptic('light');
    revealAnim.value = reducedMotion ? 1 : withTiming(1, { duration: 140 });
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
    // Миттєве приховування за 100 мс (або миттєво при Reduced Motion)
    revealAnim.value = reducedMotion ? 0 : withTiming(0, { duration: 100 });
    scanProgressAnim.value = reducedMotion ? 0 : withTiming(0, { duration: 120 });

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const secretContentStyle = useAnimatedStyle(() => ({
    opacity: revealAnim.value,
    transform: [{ scale: reducedMotion ? 1 : 0.96 + revealAnim.value * 0.04 }],
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
      accessibilityRole="button"
      accessibilityLabel="Утримуй палець на сканері, щоб побачити свою роль"
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
          {/* Classified Folder Corner Brackets */}
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />

          <View
            style={[
              styles.targetRing,
              hasSeenRole && styles.targetRingSeen,
            ]}
          >
            {hasSeenRole ? (
              <CheckCircle2 size={36} color={COLORS.crocodile} />
            ) : (
              <Fingerprint size={40} color={COLORS.spy} />
            )}
          </View>

          <View
            style={[
              styles.dossierTag,
              hasSeenRole && styles.dossierTagSeen,
            ]}
          >
            <Text
              style={[
                styles.coverOverline,
                hasSeenRole && { color: COLORS.crocodile },
              ]}
            >
              {hasSeenRole ? 'ДОСТУП ПІДТВЕРДЖЕНО' : 'ЦІЛКОМ ТАЄМНО'}
            </Text>
          </View>

          <Text style={styles.coverTitle}>
            {hasSeenRole
              ? 'Передай телефон далі'
              : 'Затисни сканер пальцем'}
          </Text>
          <Text style={styles.coverSub}>
            {hasSeenRole
              ? 'Утримуй ще раз, якщо хочеш перевірити роль'
              : 'Тримай 0.6 сек · сусіди не повинні бачити'}
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
    backgroundColor: '#1B1116',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.24)',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainerSpy: {
    backgroundColor: '#2D0F18',
    borderColor: COLORS.spy,
  },
  cardContainerCitizen: {
    backgroundColor: '#0E2420',
    borderColor: COLORS.crocodile,
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
    backgroundColor: '#191015',
  },
  cornerTL: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    borderTopRightRadius: 4,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    borderBottomRightRadius: 4,
  },
  dossierTag: {
    backgroundColor: 'rgba(244, 63, 94, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: 10,
  },
  dossierTagSeen: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  targetRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(244, 63, 94, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  targetRingSeen: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  coverOverline: {
    color: COLORS.spy,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
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
