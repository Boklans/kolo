import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Dices, Flame, RefreshCw, Sparkles, X } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import {
  ForfeitIntensity,
  PARTY_FORFEITS,
  TeamMascot,
} from '@/constants/mascots';
import {
  playCountdownGo,
  playSpyDrumrollTick,
  triggerHaptic,
} from '@/utils/sound';

interface ForfeitWheelModalProps {
  visible: boolean;
  onClose: () => void;
  targetTeamName: string;
  targetMascot?: TeamMascot;
}

const INTENSITY_TABS: {
  id: ForfeitIntensity;
  label: string;
  accent: string;
}[] = [
  { id: 'light', label: 'Лайт', accent: COLORS.crocodile },
  { id: 'chaos', label: 'Треш', accent: COLORS.hot },
  { id: 'hot18', label: '18+', accent: COLORS.spy },
];

export function ForfeitWheelModal({
  visible,
  onClose,
  targetTeamName,
  targetMascot,
}: ForfeitWheelModalProps) {
  const [intensity, setIntensity] = useState<ForfeitIntensity>('light');
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [hasResult, setHasResult] = useState(false);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();
  const reelScale = useSharedValue(1);

  const pool = PARTY_FORFEITS[intensity];

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!visible && spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
      setIsSpinning(false);
    }
  }, [visible]);

  const reelAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reelScale.value }],
  }));

  const handleSelectIntensity = (next: ForfeitIntensity) => {
    if (isSpinning) return;
    triggerHaptic('selection');
    setIntensity(next);
    setHasResult(false);
    setDisplayIndex(0);
  };

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setHasResult(false);
    triggerHaptic('medium');

    const totalTicks = reducedMotion ? 1 : 18;
    const finalIndex = Math.floor(Math.random() * pool.length);
    let step = 0;

    const tick = () => {
      step += 1;
      const progress = step / totalTicks;
      if (step < totalTicks) {
        setDisplayIndex((prev) => (prev + 1) % pool.length);
        playSpyDrumrollTick(progress);
        const delay = 55 + Math.pow(progress, 2.2) * 200;
        spinTimerRef.current = setTimeout(tick, delay);
      } else {
        setDisplayIndex(finalIndex);
        setIsSpinning(false);
        setHasResult(true);
        playCountdownGo();
        triggerHaptic('success');
        if (!reducedMotion) {
          reelScale.value = withSequence(
            withTiming(1.04, { duration: 110 }),
            withTiming(1, { duration: 160 })
          );
        }
      }
    };

    tick();
  };

  const activeAccent =
    INTENSITY_TABS.find((t) => t.id === intensity)?.accent ?? COLORS.hot;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isSpinning) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.mascotBox,
                  {
                    backgroundColor:
                      targetMascot?.bgTint ?? 'rgba(249, 115, 22, 0.18)',
                  },
                ]}
              >
                <Text style={styles.mascotEmoji}>
                  {targetMascot?.emoji ?? '🎯'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.overline}>КОЛЕСО ФАНТІВ</Text>
                <Text style={styles.title} numberOfLines={1}>
                  Для: {targetTeamName}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              disabled={isSpinning}
              onPress={onClose}
              style={[styles.closeBtn, isSpinning && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Закрити колесо фантів"
            >
              <X size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Intensity Tabs */}
          <View style={styles.tabsBar}>
            {INTENSITY_TABS.map((tab) => {
              const active = intensity === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  activeOpacity={0.85}
                  disabled={isSpinning}
                  onPress={() => handleSelectIntensity(tab.id)}
                  style={[
                    styles.tabBtn,
                    active && { backgroundColor: tab.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      active && {
                        color:
                          tab.id === 'light'
                            ? COLORS.background
                            : COLORS.textPrimary,
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Slot Reel Stage */}
          <Animated.View
            style={[
              styles.reelBox,
              hasResult && styles.reelBoxResult,
              reelAnimStyle,
            ]}
          >
            {!hasResult && !isSpinning ? (
              <View style={styles.reelPlaceholder}>
                <Dices size={30} color={activeAccent} />
                <Text style={styles.placeholderText}>
                  Натисніть «Крутнути», щоб визначити фінальний фант для
                  команди <Text style={styles.boldText}>{targetTeamName}</Text>.
                </Text>
              </View>
            ) : (
              <Animated.View
                key={`${intensity}-${displayIndex}`}
                entering={reducedMotion ? undefined : FadeIn.duration(90)}
                style={styles.reelResultInner}
              >
                <View style={styles.statusRow}>
                  {hasResult ? (
                    <>
                      <Sparkles size={13} color="#FDBA74" />
                      <Text style={styles.resultTag}>ВИПАЛО ЗАВДАННЯ</Text>
                    </>
                  ) : (
                    <>
                      <Flame size={13} color={COLORS.textMuted} />
                      <Text style={styles.spinningTag}>КРУТИМО БАРАБАН...</Text>
                    </>
                  )}
                </View>
                <Text style={styles.forfeitText}>{pool[displayIndex]}</Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Spin CTA */}
          <TouchableOpacity
            activeOpacity={0.88}
            disabled={isSpinning}
            onPress={handleSpin}
            style={[
              styles.spinBtn,
              {
                backgroundColor: activeAccent,
                borderBottomColor:
                  intensity === 'light'
                    ? COLORS.lipCrocodile
                    : intensity === 'chaos'
                      ? COLORS.lipHot
                      : COLORS.lipSpy,
              },
              isSpinning && { opacity: 0.65 },
            ]}
          >
            <RefreshCw
              size={17}
              color={
                intensity === 'light' ? COLORS.background : COLORS.textPrimary
              }
            />
            <Text
              style={[
                styles.spinBtnText,
                intensity === 'light' && { color: COLORS.background },
              ]}
            >
              {isSpinning
                ? 'КРУТИТЬСЯ...'
                : hasResult
                  ? 'КРУТНУТИ ЩЕ РАЗ'
                  : 'КРУТНУТИ КОЛЕСО ФАНТІВ'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 10, 0.88)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl + 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  mascotBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: {
    fontSize: 21,
  },
  overline: {
    color: '#FDBA74',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsBar: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: COLORS.surfaceSubtle,
    padding: 4,
    borderRadius: RADIUS.md + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  reelBox: {
    minHeight: 168,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelBoxResult: {
    backgroundColor: '#1E1418',
    borderColor: 'rgba(249, 115, 22, 0.55)',
  },
  reelPlaceholder: {
    alignItems: 'center',
    gap: 10,
  },
  placeholderText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  boldText: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  reelResultInner: {
    alignItems: 'center',
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  resultTag: {
    color: '#FDBA74',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  spinningTag: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  forfeitText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 23,
  },
  spinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
    borderRadius: RADIUS.lg + 2,
    borderBottomWidth: 4,
    paddingHorizontal: SPACING.lg,
  },
  spinBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
