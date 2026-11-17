import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ArrowDown, ArrowUp, Ban, Flame, RotateCcw, ShieldAlert } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { AbsoluteTimer } from '@/components/game/AbsoluteTimer';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { TabooItem, TabooStep } from '@/types';
import {
  playCountdownBeep,
  playCountdownGo,
  playVictoryFanfare,
  playWordGuessed,
  playWordSkipped,
  triggerHaptic,
} from '@/utils/sound';

type TabooPhase = 'READY' | 'COUNTDOWN' | 'PLAYING' | 'OVERTIME' | 'REVIEW';

interface RoundWordRecord {
  id: string;
  word: string;
  points: -1 | 0 | 1 | 2;
  isBonus?: boolean;
}

const SWIPE_THRESHOLD = 70;

function getWordFontSize(text: string): number {
  const longest = Math.max(
    ...text
      .trim()
      .split(/\s+/)
      .map((w) => w.length),
    1
  );
  if (longest >= 15) return 26;
  if (longest >= 12) return 31;
  if (longest >= 9) return 36;
  return 40;
}

export default function TabooGameScreen() {
  const router = useRouter();

  const steps = usePartyStore((s) => s.steps);
  const currentStepIndex = usePartyStore((s) => s.currentStepIndex);
  const teams = usePartyStore((s) => s.teams);
  const currentTeamIndex = usePartyStore((s) => s.currentTeamIndex);
  const currentRoundInStep = usePartyStore((s) => s.currentRoundInStep);
  const submitTeamTurnResult = usePartyStore((s) => s.submitTeamTurnResult);

  const resolveStepDeck = useDeckStore((s) => s.resolveStepDeck);
  const drawNextItem = useUsedContentStore((s) => s.drawNextItem);

  const currentStep = useMemo(() => {
    const raw = steps[currentStepIndex];
    if (raw && raw.gameType === 'taboo') {
      return raw as TabooStep;
    }
    return {
      id: 'fallback_taboo',
      deckId: 'base_ua',
      gameType: 'taboo',
      roundTimeSec: 60,
      penaltyForTaboo: true,
      roundsPerTeam: 1,
      scoring: { type: 'team', groupId: 'main' },
    } as TabooStep;
  }, [steps, currentStepIndex]);

  const deck = useMemo(() => {
    const found = resolveStepDeck(
      currentStep.deckId,
      currentStep.deckIds,
      currentStep.minDifficulty
    );
    if (found && found.items.taboo && found.items.taboo.length > 0) {
      return found;
    }
    return baseUaDeck;
  }, [resolveStepDeck, currentStep.deckId, currentStep.deckIds, currentStep.minDifficulty]);

  const currentTeam = teams[currentTeamIndex] ?? {
    id: 'team_1',
    name: 'Команда 1',
    scoresByGroup: { main: 0 },
  };

  const currentTeamTotalScore = useMemo(
    () =>
      Object.values(currentTeam.scoresByGroup).reduce(
        (acc, val) => acc + val,
        0
      ),
    [currentTeam.scoresByGroup]
  );

  const [phase, setPhase] = useState<TabooPhase>('READY');
  const [countdownLabel, setCountdownLabel] = useState<string>('3');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentCard, setCurrentCard] = useState<TabooItem | null>(null);
  const [lastSwipedCard, setLastSwipedCard] = useState<TabooItem | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundWordRecord[]>([]);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [feedbackBurst, setFeedbackBurst] = useState<{
    text: string;
    type: 'success' | 'skip';
  } | null>(null);

  const roundWordIdsRef = useRef<string[]>([]);
  const isAnimatingDecisionRef = useRef<boolean>(false);
  const streakRef = useRef<number>(0);
  const isSubmittingRef = useRef<boolean>(false);

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const flashSuccessOpacity = useSharedValue(0);
  const flashSkipOpacity = useSharedValue(0);

  const countdownScale = useSharedValue(0.6);
  const countdownOpacity = useSharedValue(0);

  const burstOpacity = useSharedValue(0);
  const burstTranslateY = useSharedValue(0);
  const burstScale = useSharedValue(0.7);

  const animateCardEntrance = useCallback(() => {
    translateY.value = 22;
    translateX.value = 0;
    cardScale.value = 0.93;
    cardOpacity.value = 0;
    flashSuccessOpacity.value = 0;
    flashSkipOpacity.value = 0;

    translateY.value = withSpring(0, { damping: 18, stiffness: 260 });
    cardScale.value = withSpring(1, { damping: 16, stiffness: 240 });
    cardOpacity.value = withTiming(1, { duration: 120 });
  }, [
    translateY,
    translateX,
    cardScale,
    cardOpacity,
    flashSuccessOpacity,
    flashSkipOpacity,
  ]);

  const pullNextCard = useCallback(() => {
    const pool =
      deck.items.taboo && deck.items.taboo.length > 0
        ? deck.items.taboo
        : baseUaDeck.items.taboo;

    const next = drawNextItem(
      deck.id,
      'taboo',
      pool,
      roundWordIdsRef.current
    );
    if (next) {
      roundWordIdsRef.current = [...roundWordIdsRef.current, next.id];
      setCurrentCard(next);
      animateCardEntrance();
    }
  }, [deck, drawNextItem, animateCardEntrance]);

  const triggerFeedbackBurst = useCallback(
    (outcome: 'guessed' | 'skip' | 'taboo', isBonus?: boolean) => {
      const text =
        outcome === 'guessed'
          ? isBonus
            ? '+2 🔥'
            : '+1'
          : outcome === 'taboo'
            ? 'ТАБУ −1'
            : 'ПРОПУСК';
      setFeedbackBurst({
        text,
        type: outcome === 'guessed' ? 'success' : 'skip',
      });

      burstTranslateY.value = 0;
      burstScale.value = 0.65;
      burstOpacity.value = 1;

      burstTranslateY.value = withTiming(outcome === 'guessed' ? -38 : 28, {
        duration: 420,
      });
      burstScale.value = withSequence(
        withSpring(1.18, { damping: 12, stiffness: 260 }),
        withTiming(0.95, { duration: 180 })
      );
      burstOpacity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 340 })
      );
    },
    [burstOpacity, burstScale, burstTranslateY]
  );

  const handleStartCountdown = () => {
    roundWordIdsRef.current = [];
    streakRef.current = 0;
    isSubmittingRef.current = false;
    setRoundHistory([]);
    setLastSwipedCard(null);
    setCurrentStreak(0);
    setBestStreak(0);
    setFeedbackBurst(null);
    setCountdownLabel('3');
    setPhase('COUNTDOWN');
  };

  const handleUndoLastCard = () => {
    if (!lastSwipedCard || roundHistory.length === 0 || isPaused) return;
    triggerHaptic('light');

    const nextHistory = roundHistory.slice(0, -1);
    let maxStreak = 0;
    let running = 0;
    for (const entry of nextHistory) {
      if (entry.points > 0) {
        running += 1;
        if (running > maxStreak) maxStreak = running;
      } else {
        running = 0;
      }
    }
    streakRef.current = running;
    setCurrentStreak(running);
    setBestStreak(maxStreak);

    setRoundHistory(nextHistory);
    setCurrentCard(lastSwipedCard);
    setLastSwipedCard(null);
    animateCardEntrance();
  };

  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;

    const sequence = ['3', '2', '1', 'БЕЗ ТАБУ!'];
    let stepIdx = 0;

    const animateBeat = (label: string, isFinal: boolean) => {
      setCountdownLabel(label);
      countdownScale.value = 0.55;
      countdownOpacity.value = 0;
      countdownScale.value = withSpring(isFinal ? 1.1 : 1, {
        damping: 12,
        stiffness: 240,
      });
      countdownOpacity.value = withTiming(1, { duration: 110 });

      if (isFinal) {
        playCountdownGo();
      } else {
        playCountdownBeep();
      }
    };

    animateBeat(sequence[0], false);

    const interval = setInterval(() => {
      stepIdx += 1;
      if (stepIdx < sequence.length) {
        animateBeat(sequence[stepIdx], stepIdx === sequence.length - 1);
      } else {
        clearInterval(interval);
        pullNextCard();
        setPhase('PLAYING');
      }
    }, 650);

    return () => clearInterval(interval);
  }, [phase, countdownScale, countdownOpacity, pullNextCard]);

  const handleTimerExpire = useCallback(() => {
    setPhase((prev) => (prev === 'PLAYING' ? 'OVERTIME' : prev));
  }, []);

  const commitCardDecision = useCallback(
    (outcome: 'guessed' | 'skip' | 'taboo') => {
      isAnimatingDecisionRef.current = false;
      if (!currentCard) return;

      const isBonus = currentCard.difficulty === 3;
      const points: -1 | 0 | 1 | 2 =
        outcome === 'guessed'
          ? isBonus
            ? 2
            : 1
          : outcome === 'taboo' && currentStep.penaltyForTaboo
            ? -1
            : 0;

      const record: RoundWordRecord = {
        id: `${currentCard.id}_${Date.now()}`,
        word: currentCard.word,
        points,
        isBonus,
      };

      setLastSwipedCard(currentCard);
      setRoundHistory((prev) => [...prev, record]);

      if (outcome === 'guessed') {
        setCurrentStreak((prev) => {
          const next = prev + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        setCurrentStreak(0);
      }

      if (phase === 'OVERTIME') {
        translateY.value = 0;
        translateX.value = 0;
        cardScale.value = 1;
        cardOpacity.value = 1;
        playVictoryFanfare();
        setPhase('REVIEW');
        return;
      }

      pullNextCard();
    },
    [
      currentCard,
      currentStep.penaltyForTaboo,
      phase,
      pullNextCard,
      translateY,
      translateX,
      cardScale,
      cardOpacity,
    ]
  );

  const triggerCardDecisionWithAnimation = useCallback(
    (outcome: 'guessed' | 'skip' | 'taboo') => {
      if (!currentCard || isAnimatingDecisionRef.current) return;
      isAnimatingDecisionRef.current = true;

      if (outcome === 'guessed') {
        streakRef.current += 1;
        playWordGuessed(streakRef.current);
        flashSuccessOpacity.value = withTiming(1, { duration: 70 });
      } else {
        streakRef.current = 0;
        playWordSkipped();
        flashSkipOpacity.value = withTiming(1, { duration: 70 });
      }

      triggerFeedbackBurst(outcome, currentCard.difficulty === 3);

      const targetY = outcome === 'guessed' ? -320 : 320;
      cardOpacity.value = withTiming(0, { duration: 130 });
      cardScale.value = withTiming(0.92, { duration: 130 });
      translateY.value = withTiming(targetY, { duration: 140 }, () => {
        runOnJS(commitCardDecision)(outcome);
      });
    },
    [
      currentCard,
      flashSuccessOpacity,
      flashSkipOpacity,
      triggerFeedbackBurst,
      cardOpacity,
      cardScale,
      translateY,
      commitCardDecision,
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(phase === 'PLAYING' || phase === 'OVERTIME')
        .onUpdate((event) => {
          translateY.value = event.translationY;
          translateX.value = event.translationX * 0.25;
          const progress = Math.min(1, Math.abs(event.translationY) / 200);
          cardScale.value = 1 - progress * 0.03;

          if (event.translationY < 0) {
            flashSuccessOpacity.value = Math.min(
              0.85,
              Math.abs(event.translationY) / 140
            );
            flashSkipOpacity.value = 0;
          } else {
            flashSkipOpacity.value = Math.min(
              0.85,
              event.translationY / 140
            );
            flashSuccessOpacity.value = 0;
          }
        })
        .onEnd((event) => {
          if (event.translationY < -SWIPE_THRESHOLD) {
            runOnJS(triggerCardDecisionWithAnimation)('guessed');
          } else if (event.translationY > SWIPE_THRESHOLD) {
            runOnJS(triggerCardDecisionWithAnimation)('skip');
          } else {
            translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
            translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
            cardScale.value = withSpring(1);
            flashSuccessOpacity.value = withTiming(0, { duration: 120 });
            flashSkipOpacity.value = withTiming(0, { duration: 120 });
          }
        }),
    [
      phase,
      triggerCardDecisionWithAnimation,
      translateY,
      translateX,
      cardScale,
      flashSuccessOpacity,
      flashSkipOpacity,
    ]
  );

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotateDeg = interpolate(
      translateX.value,
      [-60, 0, 60],
      [-4, 0, 4],
      Extrapolation.CLAMP
    );
    return {
      opacity: cardOpacity.value,
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
        { scale: cardScale.value },
        { rotateZ: `${rotateDeg}deg` },
      ],
    };
  });

  const animatedSuccessOverlayStyle = useAnimatedStyle(() => ({
    opacity: flashSuccessOpacity.value,
  }));

  const animatedSkipOverlayStyle = useAnimatedStyle(() => ({
    opacity: flashSkipOpacity.value,
  }));

  const animatedBurstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [
      { translateY: burstTranslateY.value },
      { scale: burstScale.value },
    ],
  }));

  const animatedCountdownStyle = useAnimatedStyle(() => ({
    opacity: countdownOpacity.value,
    transform: [{ scale: countdownScale.value }],
  }));

  const handleToggleReviewPoints = (
    recordId: string,
    nextPoints: -1 | 0 | 1 | 2
  ) => {
    triggerHaptic('selection');
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

  const guessedWordsCount = useMemo(
    () => roundHistory.filter((r) => r.points > 0).length,
    [roundHistory]
  );

  const bonusWordsCount = useMemo(
    () => roundHistory.filter((r) => r.points > 0 && r.isBonus).length,
    [roundHistory]
  );

  const handleConfirmReview = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    triggerHaptic('success');

    const skippedWords = roundHistory
      .filter((r) => r.points <= 0)
      .map((r) => r.word);

    submitTeamTurnResult(totalRoundPoints, {
      guessedCount: guessedWordsCount,
      skippedWords,
      bestStreak,
      bonusGuessedCount: bonusWordsCount,
    });

    router.replace('/session/scoreboard');
  };

  const stepNumStr = String(currentStepIndex + 1).padStart(2, '0');
  const totalStepsStr = String(Math.max(1, steps.length)).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`ТАБУ · ${stepNumStr} / ${totalStepsStr}`}
        rightMetaText={`${currentStep.roundTimeSec} СЕК`}
        accentColor={COLORS.taboo}
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: READY */}
      {phase === 'READY' ? (
        <View style={styles.readyBody}>
          <View style={styles.calloutStageCard}>
            <View style={styles.calloutTopRow}>
              <View style={styles.roundBadge}>
                <ShieldAlert size={13} color={COLORS.taboo} />
                <Text style={styles.roundBadgeText}>
                  РАУНД {currentRoundInStep} З {currentStep.roundsPerTeam}
                </Text>
              </View>
              <Text style={styles.teamCurrentScoreText}>
                Рахунок: {currentTeamTotalScore}
              </Text>
            </View>

            <View style={styles.calloutHeroCenter}>
              <Text style={styles.calloutOverline}>МІННЕ ПОЛЕ СЛІВ</Text>
              <Text style={styles.calloutTeamName}>{currentTeam.name}</Text>
              <Text style={styles.calloutInstruction}>
                Поясни головне слово, НЕ називаючи 4 заборонені слова під ним!
                Суперник стежить через плече.
              </Text>
            </View>

            <View style={styles.calloutRulesRow}>
              <View style={styles.ruleMiniBlock}>
                <Text style={styles.ruleMiniLabel}>КОЛОДА</Text>
                <Text style={styles.ruleMiniValue} numberOfLines={1}>
                  {deck.title}
                </Text>
              </View>
              <View style={styles.ruleMiniDivider} />
              <View style={styles.ruleMiniBlock}>
                <Text style={styles.ruleMiniLabel}>СКАЗАВ ТАБУ-СЛОВО</Text>
                <Text style={[styles.ruleMiniValue, { color: COLORS.spy }]}>
                  {currentStep.penaltyForTaboo ? 'Штраф −1 бал' : 'Пропуск (0)'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.launchButton}
            onPress={handleStartCountdown}
          >
            <Text style={styles.launchButtonSub}>ГОТОВІ?</Text>
            <Text style={styles.launchButtonTitle}>ПОЧАТИ ВІДЛІК 3 · 2 · 1</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 2: COUNTDOWN */}
      {phase === 'COUNTDOWN' ? (
        <View style={styles.countdownBody}>
          <Text style={styles.countdownTeamLabel}>
            {currentTeam.name.toUpperCase()} · ОБЕРЕЖНО ЗІ СЛОВАМИ!
          </Text>
          <Animated.View
            style={[styles.countdownCircle, animatedCountdownStyle]}
          >
            <Text
              style={[
                styles.countdownNumber,
                countdownLabel === 'БЕЗ ТАБУ!' && styles.countdownGoText,
              ]}
            >
              {countdownLabel}
            </Text>
          </Animated.View>
        </View>
      ) : null}

      {/* PHASE 3 & 4: PLAYING & OVERTIME */}
      {phase === 'PLAYING' || phase === 'OVERTIME' ? (
        <View style={styles.playingBody}>
          <View style={styles.topHud}>
            <View style={styles.hudHeaderRow}>
              <View style={styles.hudTeamBlock}>
                <Text style={styles.hudTeamName} numberOfLines={1}>
                  {currentTeam.name}
                </Text>
                {currentStreak >= 2 ? (
                  <View style={styles.streakBadge}>
                    <Flame size={13} color={COLORS.hot} />
                    <Text style={styles.streakBadgeText}>
                      {currentStreak} ПІДРЯД!
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.liveScorePill}>
                <Text style={styles.liveScoreLabel}>РАУНД</Text>
                <Text
                  style={[
                    styles.liveScoreValue,
                    totalRoundPoints > 0 && { color: COLORS.crocodile },
                    totalRoundPoints < 0 && { color: COLORS.spy },
                  ]}
                >
                  {totalRoundPoints > 0
                    ? `+${totalRoundPoints}`
                    : totalRoundPoints}
                </Text>
              </View>
            </View>

            {phase === 'OVERTIME' ? (
              <View style={styles.overtimeBanner}>
                <Text style={styles.overtimeOverline}>ЧАС ВИЙШОВ!</Text>
                <Text style={styles.overtimeTitle}>
                  Фінальна картка раунду — дограйте її!
                </Text>
              </View>
            ) : (
              <AbsoluteTimer
                durationSec={currentStep.roundTimeSec}
                isRunning={phase === 'PLAYING' && !isPaused}
                onExpire={handleTimerExpire}
                accentColor={COLORS.taboo}
                size="hero"
              />
            )}
          </View>

          {/* Word & Taboo Card Stage */}
          <View style={styles.cardStage}>
            {feedbackBurst ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.burstBadge,
                  feedbackBurst.type === 'success'
                    ? styles.burstBadgeSuccess
                    : styles.burstBadgeSkip,
                  animatedBurstStyle,
                ]}
              >
                <Text style={styles.burstBadgeText}>{feedbackBurst.text}</Text>
              </Animated.View>
            ) : null}

            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.wordSurface, animatedCardStyle]}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.cardFlashOverlay,
                    styles.cardFlashSuccess,
                    animatedSuccessOverlayStyle,
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.cardFlashOverlay,
                    styles.cardFlashSkip,
                    animatedSkipOverlayStyle,
                  ]}
                />

                <View style={styles.cardTopEdge}>
                  {currentCard?.difficulty === 3 ? (
                    <View
                      style={[
                        styles.cardCounterPill,
                        styles.cardBonusPill,
                      ]}
                    >
                      <Text style={styles.cardBonusText}>
                        🔥 БОНУС x2 · +2
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.cardCounterPill}>
                      <Text style={styles.cardCounterText}>
                        #{String(roundHistory.length + 1).padStart(2, '0')}
                      </Text>
                    </View>
                  )}

                  {lastSwipedCard && phase === 'PLAYING' ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={handleUndoLastCard}
                      style={[styles.cardCounterPill, styles.cardUndoPill]}
                      accessibilityRole="button"
                      accessibilityLabel="Повернути попереднє слово"
                    >
                      <RotateCcw size={11} color={COLORS.cardInkMuted} />
                      <Text style={styles.cardUndoText}>Повернути</Text>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}
                </View>

                <View style={styles.wordCenterWrap}>
                  <Text
                    style={[
                      styles.dominantWord,
                      {
                        fontSize: getWordFontSize(
                          isPaused ? 'ПАУЗА' : currentCard?.word ?? 'Готово'
                        ),
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {isPaused ? '⏸ ПАУЗА' : currentCard?.word ?? 'Готово'}
                  </Text>
                </View>

                {/* Forbidden Words Zone */}
                <View style={styles.tabooZone}>
                  <View style={styles.tabooZoneHeader}>
                    <Ban size={13} color={COLORS.cardTabooDangerInk} />
                    <Text style={styles.tabooZoneOverline}>
                      ЗАБОРОНЕНІ СЛОВА (НЕ ВЖИВАТИ)
                    </Text>
                  </View>
                  <View style={styles.tabooWordsGrid}>
                    {(isPaused ? [] : currentCard?.forbiddenWords ?? []).map(
                      (fw, idx) => (
                        <View key={idx} style={styles.tabooWordPill}>
                          <Text style={styles.tabooWordText}>{fw}</Text>
                        </View>
                      )
                    )}
                  </View>
                </View>
              </Animated.View>
            </GestureDetector>
          </View>

          {/* 3-Button Action Row: Skip (0), Taboo (-1), Guessed (+1/+2) */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.skipBtn}
              onPress={() => triggerCardDecisionWithAnimation('skip')}
            >
              <ArrowDown size={16} color={COLORS.textSecondary} />
              <Text style={styles.skipBtnText}>Пас (0)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.tabooPenaltyBtn}
              onPress={() => triggerCardDecisionWithAnimation('taboo')}
            >
              <Ban size={16} color={COLORS.spy} />
              <Text style={styles.tabooPenaltyBtnText}>ТАБУ −1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.guessedBtn}
              onPress={() => triggerCardDecisionWithAnimation('guessed')}
            >
              <ArrowUp size={18} color={COLORS.background} strokeWidth={2.8} />
              <Text style={styles.guessedBtnText}>
                +{currentCard?.difficulty === 3 ? '2' : '1'} ВГАДАЛИ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* PHASE 5: REVIEW */}
      {phase === 'REVIEW' ? (
        <View style={styles.reviewBody}>
          <View style={styles.roundResultHero}>
            <View style={styles.roundResultTopRow}>
              <View>
                <Text style={styles.roundResultOverline}>ПІДСУМОК РАУНДУ ТАБУ</Text>
                <Text style={styles.roundResultTeam}>{currentTeam.name}</Text>
              </View>

              <View style={styles.roundResultBigScoreBox}>
                <Text
                  style={[
                    styles.roundResultBigScore,
                    totalRoundPoints > 0 && { color: COLORS.crocodile },
                  ]}
                >
                  {totalRoundPoints > 0
                    ? `+${totalRoundPoints}`
                    : totalRoundPoints}
                </Text>
                <Text style={styles.roundResultScoreUnit}>БАЛІВ</Text>
              </View>
            </View>
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
                  {([-1, 0, item.isBonus ? 2 : 1] as (-1 | 0 | 1 | 2)[]).map(
                    (pts) => {
                      const active = item.points === pts;
                      const activeBg =
                        pts > 0
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
                                  pts > 0
                                    ? COLORS.background
                                    : COLORS.textPrimary,
                                fontWeight: '800',
                              },
                            ]}
                          >
                            {pts > 0 ? `+${pts}` : pts === -1 ? '−1' : '0'}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.reviewFooter}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.confirmReviewBtn}
              onPress={handleConfirmReview}
            >
              <Text style={styles.confirmReviewBtnText}>
                ПІДТВЕРДИТИ РАХУНОК →
              </Text>
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
    backgroundColor: COLORS.arenaTaboo,
  },
  readyBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    justifyContent: 'space-between',
  },
  calloutStageCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderTopWidth: 5,
    borderTopColor: COLORS.taboo,
    padding: SPACING.xl,
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  calloutTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  roundBadgeText: {
    color: COLORS.taboo,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  teamCurrentScoreText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  calloutHeroCenter: {
    gap: 10,
  },
  calloutOverline: {
    color: COLORS.taboo,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  calloutTeamName: {
    color: COLORS.textPrimary,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  calloutInstruction: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  calloutRulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  ruleMiniBlock: {
    flex: 1,
    gap: 2,
  },
  ruleMiniDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  ruleMiniLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  ruleMiniValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  launchButton: {
    backgroundColor: COLORS.taboo,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipTaboo,
    borderRadius: RADIUS.xl,
    paddingVertical: 17,
    alignItems: 'center',
    gap: 2,
  },
  launchButtonSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  launchButtonTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  countdownBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xl,
  },
  countdownTeamLabel: {
    color: COLORS.taboo,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  countdownCircle: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: COLORS.surface,
    borderWidth: 4,
    borderColor: COLORS.taboo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: COLORS.textPrimary,
    fontSize: 102,
    fontWeight: '900',
    letterSpacing: -3.5,
  },
  countdownGoText: {
    fontSize: 30,
    color: COLORS.crocodile,
  },
  playingBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  topHud: {
    gap: 8,
  },
  hudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hudTeamBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  hudTeamName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  streakBadgeText: {
    color: COLORS.hot,
    fontSize: 10,
    fontWeight: '900',
  },
  liveScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  liveScoreLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  liveScoreValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  overtimeBanner: {
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderRadius: RADIUS.lg,
    padding: 12,
    alignItems: 'center',
  },
  overtimeOverline: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  overtimeTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
  },
  burstBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  burstBadgeSuccess: {
    backgroundColor: COLORS.crocodile,
  },
  burstBadgeSkip: {
    backgroundColor: COLORS.spy,
  },
  burstBadgeText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  wordSurface: {
    flex: 1,
    backgroundColor: COLORS.cardPaper,
    borderRadius: RADIUS.xl,
    borderBottomWidth: 6,
    borderBottomColor: COLORS.lipPaper,
    padding: SPACING.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardFlashOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cardFlashSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.34)',
  },
  cardFlashSkip: {
    backgroundColor: 'rgba(244, 63, 94, 0.3)',
  },
  cardTopEdge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCounterPill: {
    backgroundColor: 'rgba(18, 18, 24, 0.07)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  cardCounterText: {
    color: COLORS.cardInkMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  cardBonusPill: {
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
  },
  cardBonusText: {
    color: '#C2410C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cardUndoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardUndoText: {
    color: COLORS.cardInkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  swipeDirectionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeUpHintText: {
    color: COLORS.crocodile,
    fontSize: 11,
    fontWeight: '800',
  },
  wordCenterWrap: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dominantWord: {
    color: COLORS.cardInk,
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1.2,
  },
  tabooZone: {
    backgroundColor: COLORS.cardTabooDangerBg,
    borderWidth: 1,
    borderColor: 'rgba(190, 18, 60, 0.16)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 10,
  },
  tabooZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabooZoneOverline: {
    color: COLORS.cardTabooDangerInk,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  tabooWordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabooWordPill: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(190, 18, 60, 0.14)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  tabooWordText: {
    color: COLORS.cardTabooDangerInk,
    fontSize: 15,
    fontWeight: '800',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skipBtn: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipNeutral,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
  },
  skipBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  tabooPenaltyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.spy,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipSpy,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
  },
  tabooPenaltyBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  guessedBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.crocodile,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipCrocodile,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
  },
  guessedBtnText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '900',
  },
  reviewBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  roundResultHero: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  roundResultTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundResultOverline: {
    color: COLORS.taboo,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  roundResultTeam: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '900',
  },
  roundResultBigScoreBox: {
    alignItems: 'flex-end',
  },
  roundResultBigScore: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: '900',
  },
  roundResultScoreUnit: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  reviewScroll: {
    flex: 1,
  },
  reviewListContent: {
    gap: 8,
    paddingBottom: SPACING.lg,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  reviewWord: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentOption: {
    minWidth: 42,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
  },
  segmentOptionText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewFooter: {
    paddingTop: 4,
  },
  confirmReviewBtn: {
    backgroundColor: COLORS.taboo,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipTaboo,
    paddingVertical: 17,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  confirmReviewBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
