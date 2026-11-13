import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  EyeOff,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  Skull,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { AbsoluteTimer } from '@/components/game/AbsoluteTimer';
import { HoldToRevealCard } from '@/components/game/HoldToRevealCard';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { SpyLocation, SpyStep } from '@/types';
import {
  playSpyDrumrollTick,
  playSpyUnmaskedSting,
  playVictoryFanfare,
} from '@/utils/sound';

type SpyPhase = 'ROLE_DISTRIBUTION' | 'DISCUSSION' | 'RESOLUTION';

const INTERROGATION_QUESTIONS = [
  'У чому сюди зазвичай приходять одягнені?',
  'О котрій годині в цьому місці найбільше людей?',
  'Скільки грошей ти б узяв із собою сюди?',
  'Чи ходять у це місце з маленькими дітьми?',
  'Який звук або запах тут відчувається найсильніше?',
  'Як часто ти буваєш у подібному місці за рік?',
  'Що тут категорично заборонено робити?',
  'Чи потрібні документи або квиток, щоб сюди потрапити?',
  'Якби тут знімали кіно, якого жанру воно б було?',
  'Хто за столом найбільше підходить для роботи в цьому місці?',
];

const UNMASK_HOLD_MS = 1400;

export default function SpyGameScreen() {
  const router = useRouter();

  const steps = usePartyStore((s) => s.steps);
  const currentStepIndex = usePartyStore((s) => s.currentStepIndex);
  const playerCount = usePartyStore((s) => s.playerCount);
  const advanceToNextStep = usePartyStore((s) => s.advanceToNextStep);

  const getDeckById = useDeckStore((s) => s.getDeckById);
  const drawNextItem = useUsedContentStore((s) => s.drawNextItem);

  const currentStep = useMemo(() => {
    const raw = steps[currentStepIndex];
    if (raw && raw.gameType === 'spy') {
      return raw as SpyStep;
    }
    return {
      id: 'fallback_spy',
      deckId: 'base_ua',
      gameType: 'spy',
      spyCount: 1,
      discussionTimeSec: 300,
      scoring: { type: 'none' },
    } as SpyStep;
  }, [steps, currentStepIndex]);

  const activeDeck = useMemo(() => {
    const requested = getDeckById(currentStep.deckId);
    if (requested && requested.items.spyLocations.length > 0) {
      return requested;
    }
    return baseUaDeck;
  }, [getDeckById, currentStep.deckId]);

  const [phase, setPhase] = useState<SpyPhase>('ROLE_DISTRIBUTION');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [secretLocation, setSecretLocation] = useState<SpyLocation | null>(null);
  const [spyIndices, setSpyIndices] = useState<number[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [hasSeenRole, setHasSeenRole] = useState<boolean>(false);

  // Discussion helpers
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [crossedLocationIds, setCrossedLocationIds] = useState<string[]>([]);

  // Resolution Drumroll Unmasking state
  const [isUnmaskingHold, setIsUnmaskingHold] = useState<boolean>(false);
  const [isTruthRevealed, setIsTruthRevealed] = useState<boolean>(false);
  const [winnerSide, setWinnerSide] = useState<'citizens' | 'spy' | null>(null);

  const unmaskIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmaskStartRef = useRef<number>(0);
  const unmaskProgress = useSharedValue(0);
  const unmaskScale = useSharedValue(1);
  const truthCardScale = useSharedValue(0.9);

  useEffect(() => {
    const chosenLocation =
      drawNextItem(
        activeDeck.id,
        'spyLocations',
        activeDeck.items.spyLocations
      ) ?? activeDeck.items.spyLocations[0];

    setSecretLocation(chosenLocation ?? null);

    const safePlayerCount = Math.max(3, playerCount);
    const actualSpyCount = Math.max(
      1,
      Math.min(currentStep.spyCount, Math.floor(safePlayerCount / 2))
    );

    const indicesPool = Array.from({ length: safePlayerCount }, (_, i) => i);
    for (let i = indicesPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indicesPool[i];
      indicesPool[i] = indicesPool[j];
      indicesPool[j] = temp;
    }

    setSpyIndices(indicesPool.slice(0, actualSpyCount).sort((a, b) => a - b));
    setCurrentPlayerIndex(0);
    setHasSeenRole(false);
    setCrossedLocationIds([]);
    setQuestionIndex(Math.floor(Math.random() * INTERROGATION_QUESTIONS.length));
    setIsTruthRevealed(false);
    setWinnerSide(null);
    setPhase('ROLE_DISTRIBUTION');
  }, [activeDeck, currentStep.id, currentStep.spyCount, playerCount, drawNextItem]);

  useEffect(() => {
    return () => {
      if (unmaskIntervalRef.current) {
        clearInterval(unmaskIntervalRef.current);
      }
    };
  }, []);

  const isCurrentPlayerSpy = spyIndices.includes(currentPlayerIndex);
  const isLastPlayer = currentPlayerIndex >= playerCount - 1;

  const currentPlayerRoleName = useMemo(() => {
    if (isCurrentPlayerSpy || !secretLocation?.roles?.length) {
      return undefined;
    }
    return secretLocation.roles[currentPlayerIndex % secretLocation.roles.length];
  }, [isCurrentPlayerSpy, secretLocation, currentPlayerIndex]);

  const handleNextPlayerOrStartDiscussion = () => {
    if (!hasSeenRole) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isLastPlayer) {
      setPhase('DISCUSSION');
    } else {
      setCurrentPlayerIndex((prev) => prev + 1);
      setHasSeenRole(false);
    }
  };

  const handleCycleQuestion = () => {
    Haptics.selectionAsync();
    setQuestionIndex((prev) => (prev + 1) % INTERROGATION_QUESTIONS.length);
  };

  const handleToggleLocationCross = (locId: string) => {
    Haptics.selectionAsync();
    setCrossedLocationIds((prev) =>
      prev.includes(locId)
        ? prev.filter((id) => id !== locId)
        : [...prev, locId]
    );
  };

  const handleGoToResolution = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setIsTruthRevealed(false);
    setWinnerSide(null);
    unmaskProgress.value = 0;
    setPhase('RESOLUTION');
  };

  // Dramatic 1.4s Drumroll Hold-to-Unmask
  const handleStartUnmaskHold = () => {
    if (isTruthRevealed) return;
    setIsUnmaskingHold(true);
    unmaskStartRef.current = Date.now();
    unmaskProgress.value = withTiming(1, { duration: UNMASK_HOLD_MS });
    unmaskScale.value = withTiming(1.05, { duration: UNMASK_HOLD_MS });

    playSpyDrumrollTick(0.1);

    if (unmaskIntervalRef.current) {
      clearInterval(unmaskIntervalRef.current);
    }

    unmaskIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - unmaskStartRef.current;
      const ratio = Math.min(1, elapsed / UNMASK_HOLD_MS);

      if (ratio >= 1) {
        if (unmaskIntervalRef.current) {
          clearInterval(unmaskIntervalRef.current);
          unmaskIntervalRef.current = null;
        }
        setIsUnmaskingHold(false);
        playSpyUnmaskedSting();
        truthCardScale.value = 0.88;
        truthCardScale.value = withSpring(1, { damping: 13, stiffness: 220 });
        setIsTruthRevealed(true);
      } else {
        playSpyDrumrollTick(ratio);
      }
    }, 155);
  };

  const handleStopUnmaskHold = () => {
    if (isTruthRevealed) return;
    setIsUnmaskingHold(false);
    if (unmaskIntervalRef.current) {
      clearInterval(unmaskIntervalRef.current);
      unmaskIntervalRef.current = null;
    }
    unmaskProgress.value = withTiming(0, { duration: 180 });
    unmaskScale.value = withSpring(1);
  };

  const handleSelectWinnerSide = (side: 'citizens' | 'spy') => {
    setWinnerSide(side);
    playVictoryFanfare();
  };

  const handleFinishSpyStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceToNextStep();
    const updatedState = usePartyStore.getState();
    if (updatedState.isCompleted) {
      router.replace('/session/scoreboard');
    } else {
      router.replace('/session/orchestrator');
    }
  };

  const animatedUnmaskBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: unmaskScale.value }],
  }));

  const animatedUnmaskFillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(unmaskProgress.value * 100)}%`,
  }));

  const animatedTruthCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: truthCardScale.value }],
  }));

  const stepNumStr = String(currentStepIndex + 1).padStart(2, '0');
  const totalStepsStr = String(Math.max(1, steps.length)).padStart(2, '0');
  const playerNumStr = String(currentPlayerIndex + 1).padStart(2, '0');
  const totalPlayersStr = String(playerCount).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`ШПИГУН · ${stepNumStr} / ${totalStepsStr}`}
        rightMetaText={
          phase === 'ROLE_DISTRIBUTION'
            ? `${playerNumStr} / ${totalPlayersStr}`
            : `${currentStep.discussionTimeSec / 60} ХВ`
        }
        accentColor={COLORS.spy}
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: ROLE_DISTRIBUTION */}
      {phase === 'ROLE_DISTRIBUTION' ? (
        <View style={styles.distributionBody}>
          <View style={styles.handoffHeader}>
            <View style={styles.playerHeaderTopRow}>
              <Text style={styles.playerOverline}>
                ТАЄМНИЙ ПРОТОКОЛ · {playerNumStr} / {totalPlayersStr}
              </Text>

              {/* Progress Dots for Players */}
              <View style={styles.playerDotsRow}>
                {Array.from({ length: playerCount }).map((_, idx) => {
                  const isDone = idx < currentPlayerIndex;
                  const isCurrent = idx === currentPlayerIndex;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.playerDot,
                        isDone && styles.playerDotDone,
                        isCurrent && styles.playerDotCurrent,
                      ]}
                    />
                  );
                })}
              </View>
            </View>

            <Text style={styles.passHeadline}>
              Гравець №{currentPlayerIndex + 1}
            </Text>
          </View>

          <HoldToRevealCard
            playerNumber={currentPlayerIndex + 1}
            isSpy={isCurrentPlayerSpy}
            locationName={secretLocation?.name ?? 'Таємна локація'}
            roleName={currentPlayerRoleName}
            hasSeenRole={hasSeenRole}
            onRevealedEnough={() => setHasSeenRole(true)}
          />

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!hasSeenRole}
            style={[
              styles.primaryBtn,
              !hasSeenRole && styles.primaryBtnDisabled,
            ]}
            onPress={handleNextPlayerOrStartDiscussion}
          >
            <Text
              style={[
                styles.primaryBtnText,
                !hasSeenRole && styles.primaryBtnTextDisabled,
              ]}
            >
              {hasSeenRole
                ? isLastPlayer
                  ? 'ПОЧАТИ ДОПИТ ЗА СТОЛОМ →'
                  : `ПЕРЕДАТИ ТЕЛЕФОН ГРАВЦЮ №${currentPlayerIndex + 2} →`
                : 'УТРИМУЙ СКАНЕР 1 СЕК ДЛЯ ПЕРЕВІРКИ РОЛІ'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 2: DISCUSSION */}
      {phase === 'DISCUSSION' ? (
        <View style={styles.discussionBody}>
          <View style={styles.discussionTop}>
            <View style={styles.discussionMetaRow}>
              <Text style={styles.discussionLabel}>ТРИВАЄ ДОПИТ</Text>
              <Text style={styles.discussionSpyCount}>
                Шпигунів за столом: {spyIndices.length}
              </Text>
            </View>

            <AbsoluteTimer
              durationSec={currentStep.discussionTimeSec}
              isRunning={phase === 'DISCUSSION' && !isPaused}
              onExpire={handleGoToResolution}
              accentColor={COLORS.spy}
              size="hero"
            />
          </View>

          {/* Interactive Interrogation Question Prompt */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.questionPromptCard}
            onPress={handleCycleQuestion}
          >
            <View style={styles.questionPromptHeader}>
              <View style={styles.questionTitleGroup}>
                <HelpCircle size={13} color={COLORS.spy} />
                <Text style={styles.questionOverline}>
                  ІДЕЯ ЗАПИТАННЯ ДЛЯ ДОПИТУ
                </Text>
              </View>
              <View style={styles.questionNextChip}>
                <RefreshCw size={11} color={COLORS.textSecondary} />
                <Text style={styles.questionNextText}>Інше</Text>
              </View>
            </View>
            <Text style={styles.questionText}>
              «{INTERROGATION_QUESTIONS[questionIndex]}»
            </Text>
          </TouchableOpacity>

          {/* Interactive Suspect Locations Matrix */}
          <View style={styles.locationsSection}>
            <View style={styles.locationsHeaderRow}>
              <Text style={styles.locationsHeaderLabel}>
                МОЖЛИВІ ЛОКАЦІЇ ({activeDeck.items.spyLocations.length})
              </Text>
              <Text style={styles.locationsSubHint}>
                Натисни, щоб викреслити
              </Text>
            </View>

            <ScrollView
              style={styles.locationsScroll}
              contentContainerStyle={styles.locationsGrid}
              showsVerticalScrollIndicator={false}
            >
              {activeDeck.items.spyLocations.map((loc) => {
                const isCrossed = crossedLocationIds.includes(loc.id);
                return (
                  <TouchableOpacity
                    key={loc.id}
                    activeOpacity={0.75}
                    onPress={() => handleToggleLocationCross(loc.id)}
                    style={[
                      styles.locationItem,
                      isCrossed && styles.locationItemCrossed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.locationItemText,
                        isCrossed && styles.locationItemTextCrossed,
                      ]}
                      numberOfLines={1}
                    >
                      {loc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.primaryBtn}
            onPress={handleGoToResolution}
          >
            <Text style={styles.primaryBtnText}>
              ГОЛОСУВАТИ ЗА ПІДОЗРЮВАНОГО →
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 3: RESOLUTION (DRUMROLL UNMASKING FINALE) */}
      {phase === 'RESOLUTION' ? (
        <View style={styles.resolutionBody}>
          {!isTruthRevealed ? (
            <>
              <View style={styles.resolutionHeader}>
                <Text style={styles.playerOverline}>КУЛЬМІНАЦІЯ ПАРТІЇ</Text>
                <Text style={styles.passHeadline}>Час зірвати маски</Text>
              </View>

              <View style={styles.suspenseStageCard}>
                <View style={styles.suspenseTargetCircle}>
                  <EyeOff
                    size={36}
                    color={isUnmaskingHold ? COLORS.textPrimary : COLORS.spy}
                  />
                </View>

                <Text style={styles.suspenseStepBadge}>КРОК 1 · ГОЛОСУВАННЯ</Text>
                <Text style={styles.resolutionPromptTitle}>
                  На рахунок «ТРИ» вкажіть пальцем на підозрюваного!
                </Text>
                <Text style={styles.resolutionPromptSub}>
                  Коли всі зробили свій вибір — затисніть кнопку нижче, щоб
                  розсекретити справжнього Шпигуна.
                </Text>
              </View>

              {/* Hold-to-Unmask Drumroll Button */}
              <Pressable
                onPressIn={handleStartUnmaskHold}
                onPressOut={handleStopUnmaskHold}
              >
                <Animated.View
                  style={[styles.unmaskHoldBtn, animatedUnmaskBtnStyle]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.unmaskProgressFill, animatedUnmaskFillStyle]}
                  />
                  <Text style={styles.unmaskHoldSub}>
                    {isUnmaskingHold
                      ? 'ДЕШИФРУВАННЯ ДОСЬЄ...'
                      : 'УТРИМУЙ ПАЛЕЦЬ 1.5 СЕКУНДИ'}
                  </Text>
                  <Text style={styles.unmaskHoldTitle}>
                    РОЗСЕКРЕТИТИ ШПИГУНА
                  </Text>
                </Animated.View>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.resolutionHeader}>
                <Text style={styles.playerOverline}>ДОСЬЄ РОЗСЕКРЕЧЕНО</Text>
                <Text style={styles.passHeadline}>Правда відкрита!</Text>
              </View>

              <Animated.View
                style={[styles.truthSurface, animatedTruthCardStyle]}
              >
                <View style={styles.truthSpyBanner}>
                  <Text style={styles.truthCaption}>
                    {spyIndices.length === 1
                      ? 'СПРАВЖНІЙ ШПИГУН'
                      : 'СПРАВЖНІ ШПИГУНИ'}
                  </Text>
                  <Text style={styles.truthSpyHero}>
                    {spyIndices.map((idx) => `Гравець №${idx + 1}`).join(', ')}
                  </Text>
                </View>

                <View style={styles.truthLocationBox}>
                  <Text style={styles.truthCaption}>СЕКРЕТНА ЛОКАЦІЯ</Text>
                  <Text style={styles.truthLocationHero}>
                    {secretLocation?.name}
                  </Text>
                </View>

                {/* Outcome Selector for Game Show closure */}
                <View style={styles.outcomeSection}>
                  <Text style={styles.outcomeLabel}>ХТО ПЕРЕМІГ ЗА СТОЛОМ?</Text>
                  <View style={styles.outcomeButtonsRow}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleSelectWinnerSide('citizens')}
                      style={[
                        styles.outcomeOptionBtn,
                        winnerSide === 'citizens' &&
                          styles.outcomeOptionCitizensActive,
                      ]}
                    >
                      <ShieldCheck
                        size={16}
                        color={
                          winnerSide === 'citizens'
                            ? COLORS.background
                            : COLORS.crocodile
                        }
                      />
                      <Text
                        style={[
                          styles.outcomeOptionText,
                          winnerSide === 'citizens' && {
                            color: COLORS.background,
                          },
                        ]}
                      >
                        Мирні викрили
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleSelectWinnerSide('spy')}
                      style={[
                        styles.outcomeOptionBtn,
                        winnerSide === 'spy' && styles.outcomeOptionSpyActive,
                      ]}
                    >
                      <Skull
                        size={16}
                        color={
                          winnerSide === 'spy'
                            ? COLORS.textPrimary
                            : COLORS.spy
                        }
                      />
                      <Text
                        style={[
                          styles.outcomeOptionText,
                          winnerSide === 'spy' && { color: COLORS.textPrimary },
                        ]}
                      >
                        Шпигун переміг
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.primaryBtn}
                onPress={handleFinishSpyStep}
              >
                <Text style={styles.primaryBtnText}>
                  {currentStepIndex + 1 < steps.length
                    ? 'НАСТУПНИЙ ЕТАП ВЕЧІРКИ →'
                    : 'ДО ПІДСУМКІВ ВЕЧІРКИ →'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  distributionBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },
  handoffHeader: {
    gap: 6,
  },
  playerHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerOverline: {
    color: COLORS.spy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  playerDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  playerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceElevated,
  },
  playerDotDone: {
    backgroundColor: COLORS.crocodile,
  },
  playerDotCurrent: {
    width: 18,
    backgroundColor: COLORS.spy,
  },
  passHeadline: {
    color: COLORS.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: COLORS.spy,
    height: 58,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.surface,
  },
  primaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  primaryBtnTextDisabled: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },

  // DISCUSSION
  discussionBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  discussionTop: {
    gap: 8,
  },
  discussionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discussionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  discussionSpyCount: {
    color: COLORS.spy,
    fontSize: 13,
    fontWeight: '700',
  },
  questionPromptCard: {
    backgroundColor: '#1E141B',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 6,
  },
  questionPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  questionOverline: {
    color: COLORS.spy,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  questionNextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  questionNextText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  questionText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  locationsSection: {
    flex: 1,
    gap: 8,
  },
  locationsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  locationsHeaderLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  locationsSubHint: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  locationsScroll: {
    flex: 1,
  },
  locationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: SPACING.md,
  },
  locationItem: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  locationItemCrossed: {
    backgroundColor: COLORS.surfaceSubtle,
    opacity: 0.42,
  },
  locationItemText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  locationItemTextCrossed: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },

  // RESOLUTION (DRUMROLL UNMASKING)
  resolutionBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },
  resolutionHeader: {
    gap: 4,
  },
  suspenseStageCard: {
    flex: 1,
    backgroundColor: '#1E1218',
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  suspenseTargetCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${COLORS.spy}24`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  suspenseStepBadge: {
    color: COLORS.spy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  resolutionPromptTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    lineHeight: 30,
  },
  resolutionPromptSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    textAlign: 'center',
  },
  unmaskHoldBtn: {
    width: '100%',
    height: 68,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    gap: 2,
  },
  unmaskProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.spy,
  },
  unmaskHoldSub: {
    color: 'rgba(245, 245, 247, 0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  unmaskHoldTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  // REVEALED TRUTH
  truthSurface: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    justifyContent: 'space-between',
  },
  truthSpyBanner: {
    backgroundColor: '#29121A',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  truthCaption: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  truthSpyHero: {
    color: COLORS.spy,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  truthLocationBox: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  truthLocationHero: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  outcomeSection: {
    gap: 10,
  },
  outcomeLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  outcomeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  outcomeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  outcomeOptionCitizensActive: {
    backgroundColor: COLORS.crocodile,
  },
  outcomeOptionSpyActive: {
    backgroundColor: COLORS.spy,
  },
  outcomeOptionText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
});
