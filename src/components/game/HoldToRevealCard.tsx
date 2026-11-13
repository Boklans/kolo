import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CheckCircle2, Eye, EyeOff, Fingerprint, MapPin } from 'lucide-react-native';
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
    revealAnim.value = withTiming(1, { duration: 150 });

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
    // Миттєве закриття назад під секретну шторку за 100 мс
    revealAnim.value = withTiming(0, { duration: 100 });

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

  const spyColor = COLORS.spy;
  const citizenColor = COLORS.crocodile;
  const activeRoleColor = isSpy ? spyColor : citizenColor;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressableWrap}
    >
      <View
        style={[
          styles.cardContainer,
          isHolding
            ? {
                borderColor: activeRoleColor,
                backgroundColor: `${activeRoleColor}18`,
              }
            : hasSeenRole
              ? { borderColor: `${COLORS.primary}88` }
              : { borderColor: COLORS.border },
        ]}
      >
        {/* Secret Content Layer (Visible only while holding) */}
        <Animated.View
          style={[styles.secretLayer, secretContentStyle]}
          pointerEvents="none"
        >
          {isSpy ? (
            <View style={styles.roleInner}>
              <View
                style={[
                  styles.roleIconCircle,
                  {
                    backgroundColor: `${COLORS.spy}28`,
                    borderColor: COLORS.spy,
                  },
                ]}
              >
                <EyeOff size={40} color={COLORS.spy} />
              </View>
              <Text style={[styles.roleBadge, { color: COLORS.spy }]}>
                СЕКРЕТНИЙ СТАТУС • ГРАВЕЦЬ №{playerNumber}
              </Text>
              <Text style={[styles.roleHeadline, { color: COLORS.spy }]}>
                🕵️ ТИ ШПИГУН!
              </Text>
              <Text style={styles.roleDescription}>
                Не видай себе і зрозумій за питаннями інших, у якій ви локації!
              </Text>
            </View>
          ) : (
            <View style={styles.roleInner}>
              <View
                style={[
                  styles.roleIconCircle,
                  {
                    backgroundColor: `${COLORS.crocodile}25`,
                    borderColor: COLORS.crocodile,
                  },
                ]}
              >
                <MapPin size={40} color={COLORS.crocodile} />
              </View>
              <Text style={[styles.roleBadge, { color: COLORS.crocodile }]}>
                МИРНИЙ ЖИТЕЛЬ • ГРАВЕЦЬ №{playerNumber}
              </Text>
              <Text style={styles.locationLabel}>📍 Локація:</Text>
              <Text style={styles.locationTitle}>{locationName}</Text>
              {roleName ? (
                <View style={styles.roleSuggestionPill}>
                  <Text style={styles.roleSuggestionText}>
                    Твій образ: {roleName}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.roleDescription}>
                Вирахуй шпигуна! Став хитрі запитання, щоб не спалити локацію.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Cover Curtain Layer (Visible when NOT holding) */}
        <Animated.View
          style={[styles.coverLayer, coverStyle]}
          pointerEvents="none"
        >
          <View style={styles.fingerprintCircle}>
            <Fingerprint size={44} color={COLORS.primary} />
          </View>

          <Text style={styles.playerPrompt}>Гравець №{playerNumber}</Text>
          <Text style={styles.coverInstruction}>
            Затисни та тримай палець тут, щоб побачити свою роль
          </Text>

          <View style={styles.statusPill}>
            {hasSeenRole ? (
              <>
                <CheckCircle2 size={15} color={COLORS.crocodile} />
                <Text style={[styles.statusPillText, { color: COLORS.crocodile }]}>
                  Роль переглянуто (можна передавати далі)
                </Text>
              </>
            ) : (
              <>
                <Eye size={15} color={COLORS.textSecondary} />
                <Text style={styles.statusPillText}>
                  Утримуй мінімум 0.6 сек для захисту від випадкового дотику
                </Text>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableWrap: {
    width: '100%',
    flex: 1,
    maxHeight: 410,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
  fingerprintCircle: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.full,
    backgroundColor: `${COLORS.primary}1F`,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}66`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  playerPrompt: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  coverInstruction: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  statusPillText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  roleInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  roleIconCircle: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
  },
  roleHeadline: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  locationLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  locationTitle: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  roleSuggestionPill: {
    backgroundColor: `${COLORS.crocodile}20`,
    borderWidth: 1,
    borderColor: `${COLORS.crocodile}66`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  roleSuggestionText: {
    color: COLORS.crocodile,
    fontSize: 13,
    fontWeight: '800',
  },
  roleDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
