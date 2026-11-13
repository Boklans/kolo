import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { AbsoluteTimer } from '@/components/game/AbsoluteTimer';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { AliasItem, AliasStep } from '@/types';

type AliasPhase = 'READY' | 'PLAYING' | 'OVERTIME' | 'REVIEW';

interface RoundWordRecord {
  id: string;
  word: string;
  points: -1 | 0 | 1;
}

const SWIPE_THRESHOLD = 75;

export default function AliasGameScreen() {
  const router = useRouter();

  const steps = usePartyStore((s) => s.steps);
  const currentStepIndex = usePartyStore((s) => s.currentStepIndex);
  const teams = usePartyStore((s) => s.teams);
  const currentTeamIndex = usePartyStore((s) => s.currentTeamIndex);
  const currentRoundInStep = usePartyStore((s) => s.currentRoundInStep);
  const submitTeamTurnResult = usePartyStore((s) => s.submitTeamTurnResult);

  const getDeckById = useDeckStore((s) => s.getDeckById);
  const drawNextItem = useUsedContentStore((s) => s.drawNextItem);

  const currentStep = useMemo(() => {
    const raw = steps[currentStepIndex];
    if (raw && raw.gameType === 'alias') {
      return raw as AliasStep;
    }
    return {
      id: 'fallback_alias',
      deckId: 'base_ua',
      gameType: 'alias',
      roundTimeSec: 60,
      penaltyForSkip: false,
      roundsPerTeam: 1,
      scoring: { type: 'team', groupId: 'main' },
    } as AliasStep;
  }, [steps, currentStepIndex]);

  const deck = useMemo(() => {
    const found = getDeckById(currentStep.deckId);
    if (found && found.items.alias.length > 0) {
      return found;
    }
    return baseUaDeck;
  }, [getDeckById, currentStep.deckId]);

  const currentTeam = teams[currentTeamIndex] ?? {
    id: 'team_1',
    name: 'Команда 1',
    scoresByGroup: { main: 0 },
  };

  const [phase, setPhase] = useState<AliasPhase>('READY');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentCard, setCurrentCard] = useState<AliasItem | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundWordRecord[]>([]);
  const roundWordIdsRef = useRef<string[]>([]);

  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);

  const animateCardEntrance = useCallback(() => {
    translateY.value = 14;
    cardScale.value = 0.96;
    cardOpacity.value = 0;

    translateY.value = withTiming(0, { duration: 160 });
    cardScale.value = withTiming(1, { duration: 160 });
    cardOpacity.value = withTiming(1, { duration: 150 });
  }, [translateY, cardScale, cardOpacity]);

  const pullNextCard = useCallback(() => {
    const next = drawNextItem(
      deck.id,
      'alias',
      deck.items.alias,
      roundWordIdsRef.current
    );
    if (next) {
      roundWordIdsRef.current = [...roundWordIdsRef.current, next.id];
      setCurrentCard(next);
      animateCardEntrance();
    }
  }, [deck, drawNextItem, animateCardEntrance]);

  const handleStartRound = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    roundWordIdsRef.current = [];
    setRoundHistory([]);
    pullNextCard();
    setPhase('PLAYING');
  };

  const handleTimerExpire = useCallback(() => {
    setPhase((prev) => (prev === 'PLAYING' ? 'OVERTIME' : prev));
  }, []);

  const handleCardDecision = useCallback(
    (guessed: boolean) => {
      if (!currentCard) return;

      const defaultSkipScore: -1 | 0 = currentStep.penaltyForSkip ? -1 : 0;
      const points: -1 | 0 | 1 = guessed ? 1 : defaultSkipScore;

      if (guessed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const record: RoundWordRecord = {
        id: `${currentCard.id}_${Date.now()}`,
        word: currentCard.word,
        points,
      };

      setRoundHistory((prev) => [...prev, record]);

      if (phase === 'OVERTIME') {
        translateY.value = 0;
        cardScale.value = 1;
        cardOpacity.value = 1;
        setPhase('REVIEW');
        return;
      }

      pullNextCard();
    },
    [
      currentCard,
      currentStep.penaltyForSkip,
      phase,
      pullNextCard,
      translateY,
      cardScale,
      cardOpacity,
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(phase === 'PLAYING' || phase === 'OVERTIME')
        .onUpdate((event) => {
          translateY.value = event.translationY;
          const progress = Math.min(1, Math.abs(event.translationY) / 220);
          cardScale.value = 1 - progress * 0.035;
        })
        .onEnd((event) => {
          if (event.translationY < -SWIPE_THRESHOLD) {
            cardOpacity.value = withTiming(0, { duration: 110 });
            translateY.value = withTiming(-240, { duration: 120 }, () => {
              runOnJS(handleCardDecision)(true);
            });
          } else if (event.translationY > SWIPE_THRESHOLD) {
            cardOpacity.value = withTiming(0, { duration: 110 });
            translateY.value = withTiming(240, { duration: 120 }, () => {
              runOnJS(handleCardDecision)(false);
            });
          } else {
            translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
            cardScale.value = withSpring(1);
          }
        }),
    [phase, handleCardDecision, translateY, cardScale, cardOpacity]
  );

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      opacity: cardOpacity.value,
      transform: [
        { translateY: translateY.value },
        { scale: cardScale.value },
      ],
    };
  });

  const handleToggleReviewPoints = (recordId: string, nextPoints: -1 | 0 | 1) => {
    Haptics.selectionAsync();
    setRoundHistory((prev) =>
      prev.map((item) =>
        item.id === recordId ? { ...item, points: nextPoints } : item
      )
    );
  };

  const totalRoundPoints = useMemo(
    () => roundHistory.reduce((acc, item) => acc + item.points, 0),
    [roundHistory]
  );

  const handleConfirmReview = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const guessedCount = roundHistory.filter((r) => r.points > 0).length;
    const skippedWords = roundHistory
      .filter((r) => r.points <= 0)
      .map((r) => r.word);

    submitTeamTurnResult(totalRoundPoints, {
      guessedCount,
      skippedWords,
    });

    router.replace('/session/scoreboard');
  };

  const stepNumStr = String(currentStepIndex + 1).padStart(2, '0');
  const totalStepsStr = String(Math.max(1, steps.length)).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`ЕЛІАС · ${stepNumStr} / ${totalStepsStr}`}
        rightMetaText={`${currentStep.roundTimeSec} СЕК`}
        accentColor={COLORS.alias}
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: READY */}
      {phase === 'READY' ? (
        <View style={styles.readyBody}>
          <View style={styles.readyHeader}>
            <Text style={styles.teamOverline}>
              Раунд {currentRoundInStep} з {currentStep.roundsPerTeam}
            </Text>
            <Text style={styles.teamNameHero}>{currentTeam.name}</Text>
          </View>

          <View style={styles.handoffBlock}>
            <Text style={styles.handoffIndex}>01</Text>
            <Text style={styles.handoffTitle}>Пояснюй слова команді</Text>
            <Text style={styles.handoffSub}>
              Не використовуй однокореневі слова та переклади.{' '}
              {currentStep.penaltyForSkip
                ? 'Пропуск забирає 1 бал.'
                : 'Пропуск без штрафу.'}
            </Text>
            <Text style={styles.deckLabel}>Колода: {deck.title}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.startBtn}
            onPress={handleStartRound}
          >
            <Text style={styles.startBtnText}>Почати раунд</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 2 & 3: PLAYING & OVERTIME */}
      {phase === 'PLAYING' || phase === 'OVERTIME' ? (
        <View style={styles.playingBody}>
          {/* Top Compact Info & Timer */}
          <View style={styles.topHud}>
            <View style={styles.hudMetaRow}>
              <Text style={styles.hudTeamName}>{currentTeam.name}</Text>
              <Text style={styles.hudScore}>
                {totalRoundPoints > 0 ? `+${totalRoundPoints}` : totalRoundPoints}
              </Text>
            </View>

            {phase === 'OVERTIME' ? (
              <View style={styles.overtimeStrip}>
                <Text style={styles.overtimeStripText}>
                  Час вийшов — дограйте останнє слово
                </Text>
              </View>
            ) : (
              <AbsoluteTimer
                durationSec={currentStep.roundTimeSec}
                isRunning={phase === 'PLAYING' && !isPaused}
                onExpire={handleTimerExpire}
                accentColor={COLORS.alias}
                size="compact"
              />
            )}
          </View>

          {/* Dominant Word Card */}
          <View style={styles.cardStage}>
            <GestureDetector gesture={panGesture}>
              <Animated.View
                style={[
                  styles.wordSurface,
                  phase === 'OVERTIME' && styles.wordSurfaceOvertime,
                  animatedCardStyle,
                ]}
              >
                <Text style={styles.cardIndexCounter}>
                  {String(roundHistory.length + 1).padStart(2, '0')}
                </Text>

                <Text style={styles.dominantWord}>
                  {currentCard?.word ?? 'Готово'}
                </Text>

                {roundHistory.length === 0 ? (
                  <Text style={styles.subtleSwipeHint}>
                    ↑ Свайп вгору — вгадали   ·   ↓ Вниз — пропуск
                  </Text>
                ) : (
                  <View style={styles.hintSpacer} />
                )}
              </Animated.View>
            </GestureDetector>
          </View>

          {/* Bottom Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.skipBtn}
              onPress={() => handleCardDecision(false)}
            >
              <Text style={styles.skipBtnText}>
                Пропуск{currentStep.penaltyForSkip ? '  -1' : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.guessedBtn}
              onPress={() => handleCardDecision(true)}
            >
              <Text style={styles.guessedBtnText}>Вгадали  +1</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* PHASE 4: REVIEW */}
      {phase === 'REVIEW' ? (
        <View style={styles.reviewBody}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewOverline}>{currentTeam.name}</Text>
            <Text style={styles.reviewTitle}>Перевірка слів</Text>
          </View>

          <ScrollView
            style={styles.reviewScroll}
            contentContainerStyle={styles.reviewListContent}
            showsVerticalScrollIndicator={false}
          >
            {roundHistory.map((item) => (
              <View key={item.id} style={styles.reviewRow}>
                <Text style={styles.reviewWord} numberOfLines={2}>
                  {item.word}
                </Text>

                <View style={styles.segmentGroup}>
                  {([-1, 0, 1] as const).map((pts) => {
                    const active = item.points === pts;
                    const activeBg =
                      pts === 1
                        ? COLORS.crocodile
                        : pts === -1
                          ? COLORS.spy
                          : COLORS.surfaceElevated;

                    return (
                      <TouchableOpacity
                        key={pts}
                        activeOpacity={0.8}
                        onPress={() => handleToggleReviewPoints(item.id, pts)}
                        style={[
                          styles.segmentOption,
                          active && { backgroundColor: activeBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentOptionText,
                            active && {
                              color:
                                pts === 1
                                  ? COLORS.background
                                  : COLORS.textPrimary,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {pts === 1 ? '+1' : pts === -1 ? '-1' : '0'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.reviewFooter}>
            <View style={styles.reviewTotalRow}>
              <Text style={styles.reviewTotalLabel}>Підсумок раунду</Text>
              <Text style={styles.reviewTotalValue}>
                {totalRoundPoints > 0 ? `+${totalRoundPoints}` : totalRoundPoints}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.startBtn}
              onPress={handleConfirmReview}
            >
              <Text style={styles.startBtnText}>Продовжити</Text>
            </TouchableOpacity>
          </View>
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

  // READY
  readyBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  readyHeader: {
    gap: 4,
  },
  teamOverline: {
    color: COLORS.alias,
    fontSize: 14,
    fontWeight: '600',
  },
  teamNameHero: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  handoffBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    gap: SPACING.sm,
  },
  handoffIndex: {
    color: COLORS.alias,
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginBottom: 4,
  },
  handoffTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  handoffSub: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  deckLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  startBtn: {
    width: '100%',
    backgroundColor: COLORS.alias,
    paddingVertical: 17,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },

  // PLAYING & OVERTIME
  playingBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  topHud: {
    gap: SPACING.xs,
  },
  hudMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hudTeamName: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  hudScore: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  overtimeStrip: {
    backgroundColor: `${COLORS.spy}20`,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  overtimeStripText: {
    color: COLORS.spy,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: SPACING.lg,
  },
  wordSurface: {
    flex: 1,
    maxHeight: 380,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordSurfaceOvertime: {
    borderWidth: 1.5,
    borderColor: COLORS.spy,
  },
  cardIndexCounter: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  dominantWord: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.9,
    textAlign: 'center',
    lineHeight: 44,
  },
  subtleSwipeHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  hintSpacer: {
    height: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  skipBtn: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  guessedBtn: {
    flex: 1.35,
    height: 56,
    backgroundColor: COLORS.alias,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guessedBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  // REVIEW
  reviewBody: {
    flex: 1,
    paddingTop: SPACING.xs,
  },
  reviewHeader: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    gap: 2,
  },
  reviewOverline: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  reviewTitle: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  reviewScroll: {
    flex: 1,
  },
  reviewListContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: SPACING.xs,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  reviewWord: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentOption: {
    minWidth: 40,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOptionText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewFooter: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  reviewTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewTotalLabel: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  reviewTotalValue: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
