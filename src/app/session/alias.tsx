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
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ArrowDown, ArrowUp, Dices, Flame, RotateCcw, Zap } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { AbsoluteTimer } from '@/components/game/AbsoluteTimer';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { AliasItem, AliasStep } from '@/types';
import {
  playCountdownBeep,
  playCountdownGo,
  playVictoryFanfare,
  playWordGuessed,
  playWordSkipped,
  triggerHaptic,
} from '@/utils/sound';

type AliasPhase = 'READY' | 'COUNTDOWN' | 'PLAYING' | 'OVERTIME' | 'REVIEW';

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
  if (longest >= 15) return 27;
  if (longest >= 12) return 33;
  if (longest >= 9) return 38;
  return 44;
}

const ALIAS_MODIFIERS = [
  {
    id: 'whisper',
    emoji: '🤫',
    title: 'Секретний агент',
    desc: 'Пояснюй усі слова цього раунду пошепки (+1 бонусний бал)',
  },
  {
    id: 'commentator',
    emoji: '⚽',
    title: 'Футбольний коментатор',
    desc: 'Коментуй слова на шаленій швидкості, ніби це фінал Ліги Чемпіонів (+1 бал)',
  },
  {
    id: 'no_hands',
    emoji: '🗿',
    title: 'Руки в кишенях',
    desc: 'Тримай руки за спиною — жодних жестів під час пояснення (+1 бал)',
  },
  {
    id: 'questions',
    emoji: '❓',
    title: 'Тільки питаннями',
    desc: 'Пояснюй слова виключно питальними реченнями (+1 бал)',
  },
  {
    id: 'trailer',
    emoji: '🎭',
    title: 'Кінотрейлер',
    desc: 'Пояснюй слова максимально епічним драматичним голосом (+1 бал)',
  },
];

export default function AliasGameScreen() {
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
    const found = resolveStepDeck(currentStep.deckId, currentStep.deckIds, currentStep.minDifficulty);
    if (found && found.items.alias.length > 0) {
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

  const [phase, setPhase] = useState<AliasPhase>('READY');
  const [countdownLabel, setCountdownLabel] = useState<string>('3');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentCard, setCurrentCard] = useState<AliasItem | null>(null);
  const [lastSwipedCard, setLastSwipedCard] = useState<AliasItem | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundWordRecord[]>([]);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [activeModifierIdx, setActiveModifierIdx] = useState<number | null>(null);
  const [stolenInfo, setStolenInfo] = useState<{
    teamId: string;
    teamName: string;
    word: string;
    points: number;
  } | null>(null);
  const [departingCard, setDepartingCard] = useState<{
    word: string;
    guessed: boolean;
  } | null>(null);
  const [feedbackBurst, setFeedbackBurst] = useState<{
    text: string;
    type: 'success' | 'skip';
  } | null>(null);

  const reducedMotion = useReducedMotion();
  const roundWordIdsRef = useRef<string[]>([]);
  const cardSeqRef = useRef<number>(0);
  const processedSeqRef = useRef<number>(-1);
  const streakRef = useRef<number>(0);
  const isSubmittingRef = useRef<boolean>(false);

  // Card physics shared values
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const flashSuccessOpacity = useSharedValue(0);
  const flashSkipOpacity = useSharedValue(0);

  // Departing ghost card shared values (non-blocking visual exit)
  const ghostTranslateY = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);

  // Countdown animation values
  const countdownScale = useSharedValue(0.6);
  const countdownOpacity = useSharedValue(0);

  // Score burst animation values
  const burstOpacity = useSharedValue(0);
  const burstTranslateY = useSharedValue(0);
  const burstScale = useSharedValue(0.7);

  const animateCardEntrance = useCallback(() => {
    translateX.value = 0;
    flashSuccessOpacity.value = 0;
    flashSkipOpacity.value = 0;

    if (reducedMotion) {
      translateY.value = 0;
      cardScale.value = 1;
      cardOpacity.value = 1;
      return;
    }

    translateY.value = 18;
    cardScale.value = 0.94;
    cardOpacity.value = 0.2;

    translateY.value = withSpring(0, { damping: 20, stiffness: 320 });
    cardScale.value = withSpring(1, { damping: 18, stiffness: 300 });
    cardOpacity.value = withTiming(1, { duration: 90 });
  }, [
    reducedMotion,
    translateY,
    translateX,
    cardScale,
    cardOpacity,
    flashSuccessOpacity,
    flashSkipOpacity,
  ]);

  const pullNextCard = useCallback(() => {
    const next = drawNextItem(
      deck.id,
      'alias',
      deck.items.alias,
      roundWordIdsRef.current
    );
    if (next) {
      cardSeqRef.current += 1;
      roundWordIdsRef.current = [...roundWordIdsRef.current, next.id];
      setCurrentCard(next);
      animateCardEntrance();
    }
  }, [deck, drawNextItem, animateCardEntrance]);

  const triggerFeedbackBurst = useCallback(
    (guessed: boolean, penaltyForSkip: boolean, isBonusWord?: boolean) => {
      const text = guessed
        ? isBonusWord
          ? '+2 🔥'
          : '+1'
        : penaltyForSkip
          ? '−1'
          : 'ПРОПУСК';
      setFeedbackBurst({
        text,
        type: guessed ? 'success' : 'skip',
      });

      if (reducedMotion) {
        burstTranslateY.value = 0;
        burstScale.value = 1;
        burstOpacity.value = withSequence(
          withTiming(1, { duration: 40 }),
          withTiming(0, { duration: 280 })
        );
        return;
      }

      burstTranslateY.value = 0;
      burstScale.value = 0.65;
      burstOpacity.value = 1;

      burstTranslateY.value = withTiming(guessed ? -38 : 28, { duration: 420 });
      burstScale.value = withSequence(
        withSpring(1.18, { damping: 12, stiffness: 260 }),
        withTiming(0.95, { duration: 180 })
      );
      burstOpacity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 340 })
      );
    },
    [reducedMotion, burstOpacity, burstScale, burstTranslateY]
  );

  const activeModifier =
    activeModifierIdx !== null ? ALIAS_MODIFIERS[activeModifierIdx] : null;

  const handleCycleModifier = () => {
    triggerHaptic('selection');
    setActiveModifierIdx((prev) => {
      if (prev === null) {
        return Math.floor(Math.random() * ALIAS_MODIFIERS.length);
      }
      const next = prev + 1;
      if (next >= ALIAS_MODIFIERS.length) return null;
      return next;
    });
  };

  // 3 - 2 - 1 - ПОГНАЛИ! Countdown sequence
  const handleStartCountdown = () => {
    roundWordIdsRef.current = [];
    cardSeqRef.current = 0;
    processedSeqRef.current = -1;
    streakRef.current = 0;
    isSubmittingRef.current = false;
    setRoundHistory([]);
    setLastSwipedCard(null);
    setDepartingCard(null);
    setCurrentStreak(0);
    setBestStreak(0);
    setStolenInfo(null);
    setFeedbackBurst(null);
    setCountdownLabel('3');
    setPhase('COUNTDOWN');
  };

  const handleUndoLastCard = () => {
    if (!lastSwipedCard || roundHistory.length === 0 || isPaused) return;
    triggerHaptic('light');
    cardSeqRef.current += 1;

    const nextHistory = roundHistory.slice(0, -1);
    let trailingStreak = 0;
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
    trailingStreak = running;
    streakRef.current = trailingStreak;
    setCurrentStreak(trailingStreak);
    setBestStreak(maxStreak);

    setRoundHistory(nextHistory);
    setCurrentCard(lastSwipedCard);
    setLastSwipedCard(null);
    animateCardEntrance();
  };

  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;

    const sequence = ['3', '2', '1', 'ПОГНАЛИ!'];
    let stepIdx = 0;

    const animateBeat = (label: string, isFinal: boolean) => {
      setCountdownLabel(label);
      if (reducedMotion) {
        countdownScale.value = 1;
        countdownOpacity.value = 1;
      } else {
        countdownScale.value = 0.55;
        countdownOpacity.value = 0;
        countdownScale.value = withSpring(isFinal ? 1.1 : 1, {
          damping: 12,
          stiffness: 240,
        });
        countdownOpacity.value = withTiming(1, { duration: 110 });
      }

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
  }, [phase, reducedMotion, countdownScale, countdownOpacity, pullNextCard]);

  const handleTimerExpire = useCallback(() => {
    setPhase((prev) => (prev === 'PLAYING' ? 'OVERTIME' : prev));
  }, []);

  const triggerCardDecisionWithAnimation = useCallback(
    (guessed: boolean) => {
      if (
        isPaused ||
        !currentCard ||
        processedSeqRef.current === cardSeqRef.current
      ) {
        return;
      }
      processedSeqRef.current = cardSeqRef.current;

      if (guessed) {
        streakRef.current += 1;
        playWordGuessed(streakRef.current);
      } else {
        streakRef.current = 0;
        playWordSkipped();
      }

      const isBonus = currentCard.difficulty === 3;
      const defaultSkipScore: -1 | 0 = currentStep.penaltyForSkip ? -1 : 0;
      const points: -1 | 0 | 1 | 2 = guessed ? (isBonus ? 2 : 1) : defaultSkipScore;

      triggerFeedbackBurst(guessed, currentStep.penaltyForSkip, isBonus);

      const record: RoundWordRecord = {
        id: `${currentCard.id}_${Date.now()}`,
        word: currentCard.word,
        points,
        isBonus,
      };

      setLastSwipedCard(currentCard);
      setRoundHistory((prev) => [...prev, record]);

      if (guessed) {
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
        setDepartingCard(null);
        playVictoryFanfare();
        setPhase('REVIEW');
        return;
      }

      // Non-blocking departing ghost animation so next card is interactive immediately
      if (!reducedMotion) {
        setDepartingCard({ word: currentCard.word, guessed });
        ghostTranslateY.value = translateY.value;
        ghostOpacity.value = 1;
        ghostTranslateY.value = withTiming(guessed ? -260 : 260, { duration: 170 });
        ghostOpacity.value = withTiming(0, { duration: 170 });
      }

      pullNextCard();
    },
    [
      isPaused,
      currentCard,
      currentStep.penaltyForSkip,
      phase,
      reducedMotion,
      triggerFeedbackBurst,
      pullNextCard,
      translateY,
      translateX,
      cardScale,
      cardOpacity,
      ghostTranslateY,
      ghostOpacity,
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled((phase === 'PLAYING' || phase === 'OVERTIME') && !isPaused)
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
            runOnJS(triggerCardDecisionWithAnimation)(true);
          } else if (event.translationY > SWIPE_THRESHOLD) {
            runOnJS(triggerCardDecisionWithAnimation)(false);
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
      isPaused,
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

  const animatedBackCardStyle = useAnimatedStyle(() => {
    const dragProgress = interpolate(
      Math.abs(translateY.value),
      [0, 160],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { scale: interpolate(dragProgress, [0, 1], [0.93, 0.98]) },
        { translateY: interpolate(dragProgress, [0, 1], [14, 4]) },
      ],
      opacity: interpolate(dragProgress, [0, 1], [0.45, 0.8]),
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

  const animatedGhostCardStyle = useAnimatedStyle(() => ({
    opacity: ghostOpacity.value,
    transform: [{ translateY: ghostTranslateY.value }],
  }));

  const animatedCountdownStyle = useAnimatedStyle(() => ({
    opacity: countdownOpacity.value,
    transform: [{ scale: countdownScale.value }],
  }));

  const handleStealOvertimeWord = (opponentTeam: { id: string; name: string }) => {
    if (!currentCard || processedSeqRef.current === cardSeqRef.current) return;
    processedSeqRef.current = cardSeqRef.current;
    triggerHaptic('success');
    const pts = currentCard.difficulty === 3 ? 2 : 1;
    setStolenInfo({
      teamId: opponentTeam.id,
      teamName: opponentTeam.name,
      word: currentCard.word,
      points: pts,
    });
    playVictoryFanfare();
    setPhase('REVIEW');
  };

  const handleToggleReviewPoints = (recordId: string, nextPoints: -1 | 0 | 1 | 2) => {
    triggerHaptic('selection');
    setRoundHistory((prev) =>
      prev.map((item) =>
        item.id === recordId ? { ...item, points: nextPoints } : item
      )
    );
  };

  const modifierBonusPoints = activeModifier ? 1 : 0;

  const totalRoundPoints = useMemo(
    () =>
      roundHistory.reduce((acc, item) => acc + item.points, 0) +
      modifierBonusPoints,
    [roundHistory, modifierBonusPoints]
  );

  const liveChaseStatus = useMemo(() => {
    if (teams.length < 2) return null;
    const otherScores = teams
      .filter((_, idx) => idx !== currentTeamIndex)
      .map((t) =>
        Object.values(t.scoresByGroup).reduce((acc, val) => acc + val, 0)
      );
    const maxOpponent = Math.max(0, ...otherScores);
    const liveTotal = currentTeamTotalScore + totalRoundPoints;

    if (liveTotal > maxOpponent && liveTotal > 0) {
      return {
        label: `👑 ЛІДЕР (+${liveTotal - maxOpponent})`,
        color: COLORS.hot,
      };
    }
    if (liveTotal === maxOpponent && maxOpponent > 0) {
      return {
        label: '⚡ НІЧИЯ ЗАРАЗ',
        color: COLORS.alias,
      };
    }
    if (maxOpponent > liveTotal) {
      return {
        label: `До лідера: ${maxOpponent - liveTotal}`,
        color: COLORS.textSecondary,
      };
    }
    return null;
  }, [teams, currentTeamIndex, currentTeamTotalScore, totalRoundPoints]);

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
      stolenByTeamId: stolenInfo?.teamId,
      stolenPoints: stolenInfo?.points,
    });

    router.replace('/session/scoreboard');
  };

  const stepNumStr = String(currentStepIndex + 1).padStart(2, '0');
  const totalStepsStr = String(Math.max(1, steps.length)).padStart(2, '0');

  const roundReactionHeadline = useMemo(() => {
    if (guessedWordsCount >= 8) return 'ШАЛЕНИЙ ТЕМП! 🔥';
    if (guessedWordsCount >= 5) return 'ПОТУЖНИЙ РАУНД!';
    if (guessedWordsCount >= 3) return 'ХОРОШИЙ РОЗІГРІВ!';
    return 'РАУНД ЗАВЕРШЕНО!';
  }, [guessedWordsCount]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`ЕЛІАС · ${stepNumStr} / ${totalStepsStr}`}
        rightMetaText={`${currentStep.roundTimeSec} СЕК`}
        accentColor={COLORS.alias}
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: READY (TEAM CALLOUT STAGE) */}
      {phase === 'READY' ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.readyBody}>
          <View style={styles.calloutStageCard}>
            <View style={styles.calloutTopRow}>
              <View style={styles.roundBadge}>
                <Zap size={13} color={COLORS.alias} />
                <Text style={styles.roundBadgeText}>
                  РАУНД {currentRoundInStep} З {currentStep.roundsPerTeam}
                </Text>
              </View>
              <Text style={styles.teamCurrentScoreText}>
                Рахунок: {currentTeamTotalScore}
              </Text>
            </View>

            <View style={styles.calloutHeroCenter}>
              <Text style={styles.calloutOverline}>ВАШ ВИХІД НА СЦЕНУ</Text>
              <Text style={styles.calloutTeamName}>{currentTeam.name}</Text>
              <Text style={styles.calloutInstruction}>
                Ведучий бере телефон. Пояснюй слова команді на максимальній
                швидкості!
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              <View style={styles.calloutRulesRow}>
                <View style={styles.ruleMiniBlock}>
                  <Text style={styles.ruleMiniLabel}>КОЛОДА</Text>
                  <Text style={styles.ruleMiniValue} numberOfLines={1}>
                    {deck.title}
                  </Text>
                </View>
                <View style={styles.ruleMiniDivider} />
                <View style={styles.ruleMiniBlock}>
                  <Text style={styles.ruleMiniLabel}>ПРОПУСК СЛОВА</Text>
                  <Text
                    style={[
                      styles.ruleMiniValue,
                      currentStep.penaltyForSkip && { color: COLORS.spy },
                    ]}
                  >
                    {currentStep.penaltyForSkip ? 'Штраф −1 бал' : 'Без штрафу'}
                  </Text>
                </View>
              </View>

              {/* Compact Inline Round Modifier Pill */}
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={handleCycleModifier}
                style={{
                  backgroundColor: activeModifier
                    ? 'rgba(249, 115, 22, 0.14)'
                    : COLORS.surfaceSubtle,
                  borderRadius: RADIUS.md,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  gap: 3,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Dices
                      size={13}
                      color={activeModifier ? COLORS.hot : COLORS.textMuted}
                    />
                    <Text
                      style={{
                        color: activeModifier ? COLORS.hot : COLORS.textSecondary,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {activeModifier
                        ? `${activeModifier.emoji} ${activeModifier.title} (+1 бал)`
                        : 'Додати умову раунду (+1 бал)'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: COLORS.textMuted,
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {activeModifier ? 'Змінити' : 'Вимк'}
                  </Text>
                </View>
                {activeModifier ? (
                  <Text
                    style={{
                      color: COLORS.textSecondary,
                      fontSize: 12,
                    }}
                    numberOfLines={1}
                  >
                    {activeModifier.desc}
                  </Text>
                ) : null}
              </TouchableOpacity>
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
        </Animated.View>
      ) : null}

      {/* PHASE 2: COUNTDOWN (3 - 2 - 1 - ПОГНАЛИ!) */}
      {phase === 'COUNTDOWN' ? (
        <View style={styles.countdownBody}>
          <Text style={styles.countdownTeamLabel}>
            {currentTeam.name.toUpperCase()} · ПРИГОТУЙТЕСЬ!
          </Text>
          <Animated.View
            style={[styles.countdownCircle, animatedCountdownStyle]}
          >
            <Text
              style={[
                styles.countdownNumber,
                countdownLabel === 'ПОГНАЛИ!' && styles.countdownGoText,
              ]}
            >
              {countdownLabel}
            </Text>
          </Animated.View>
          <Text style={styles.countdownSubHint}>
            Свайп вгору — вгадали (+1) · Вниз — пропуск
          </Text>
        </View>
      ) : null}

      {/* PHASE 3 & 4: PLAYING & OVERTIME */}
      {phase === 'PLAYING' || phase === 'OVERTIME' ? (
        <View style={styles.playingBody}>
          {/* Top Game Show HUD: Score + Streak + Dynamic Emotional Timer */}
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
                ) : liveChaseStatus ? (
                  <View
                    style={[
                      styles.streakBadge,
                      { backgroundColor: COLORS.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.streakBadgeText,
                        { color: liveChaseStatus.color },
                      ]}
                    >
                      {liveChaseStatus.label}
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
                <Text style={styles.overtimeOverline}>
                  ⚡ ВІДКРИТИЙ МІКРОФОН · ЧАС ВИЙШОВ!
                </Text>
                <Text style={styles.overtimeTitle}>
                  Останнє слово можуть перехопити УСІ команди!
                </Text>
              </View>
            ) : (
              <AbsoluteTimer
                durationSec={currentStep.roundTimeSec}
                isRunning={phase === 'PLAYING' && !isPaused}
                onExpire={handleTimerExpire}
                accentColor={COLORS.alias}
                size="hero"
              />
            )}
          </View>

          {/* Physical Word Deck Stage */}
          <View style={styles.cardStage}>
            {/* Floating +1 / Skip Burst */}
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

            {/* Underlying Stacked Physical Deck Layers */}
            <View pointerEvents="none" style={styles.deepDeckCard} />
            <Animated.View
              pointerEvents="none"
              style={[styles.backDeckCard, animatedBackCardStyle]}
            />

            {/* Departing Ghost Card for Instant Non-Blocking Feedback */}
            {departingCard ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.departingGhostCard,
                  departingCard.guessed
                    ? styles.departingGhostSuccess
                    : styles.departingGhostSkip,
                  animatedGhostCardStyle,
                ]}
              >
                <Text style={styles.departingGhostWord} numberOfLines={2}>
                  {departingCard.word}
                </Text>
              </Animated.View>
            ) : null}

            {/* Active Interactive Word Card */}
            <GestureDetector gesture={panGesture}>
              <Animated.View
                style={[
                  styles.wordSurface,
                  phase === 'OVERTIME' && styles.wordSurfaceOvertime,
                  animatedCardStyle,
                ]}
              >
                {/* Green Flash Overlay on Guess */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.cardFlashOverlay,
                    styles.cardFlashSuccess,
                    animatedSuccessOverlayStyle,
                  ]}
                />

                {/* Crimson Flash Overlay on Skip */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.cardFlashOverlay,
                    styles.cardFlashSkip,
                    animatedSkipOverlayStyle,
                  ]}
                />

                {/* Top Edge: Minimal Card Badge & Undo */}
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

                {/* Dominant Center Word (Smart Typography + Pause Mask) */}
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
                    {isPaused
                      ? '⏸ ПАУЗА'
                      : currentCard?.word ?? 'Готово'}
                  </Text>
                </View>

                {/* Bottom Edge: Subtle Deck Watermark */}
                <View style={[styles.cardBottomEdge, { justifyContent: 'center' }]}>
                  <Text style={styles.cardDeckWatermark} numberOfLines={1}>
                    {deck.title}
                  </Text>
                </View>
              </Animated.View>
            </GestureDetector>
          </View>

          {/* Bottom Tactile Action Buttons (or Overtime Steal Panel) */}
          {phase === 'OVERTIME' && teams.length > 1 ? (
            <View style={{ gap: 8 }}>
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.skipBtn}
                  onPress={() => triggerCardDecisionWithAnimation(false)}
                >
                  <ArrowDown size={18} color={COLORS.textSecondary} />
                  <Text style={styles.skipBtnText}>Ніхто не вгадав</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.guessedBtn}
                  onPress={() => triggerCardDecisionWithAnimation(true)}
                >
                  <ArrowUp size={18} color={COLORS.background} strokeWidth={2.8} />
                  <Text style={styles.guessedBtnText} numberOfLines={1}>
                    {currentTeam.name} +{currentCard?.difficulty === 3 ? '2' : '1'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {teams
                  .filter((_, idx) => idx !== currentTeamIndex)
                  .map((oppTeam) => (
                    <TouchableOpacity
                      key={oppTeam.id}
                      activeOpacity={0.85}
                      onPress={() => handleStealOvertimeWord(oppTeam)}
                      style={{
                        flex: 1,
                        minWidth: '45%',
                        backgroundColor: 'rgba(249, 115, 22, 0.18)',
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: RADIUS.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: COLORS.hot,
                          fontSize: 12,
                          fontWeight: '900',
                          letterSpacing: 0.4,
                        }}
                        numberOfLines={1}
                      >
                        ⚡ ПЕРЕХОПИЛИ: {oppTeam.name.toUpperCase()} +
                        {currentCard?.difficulty === 3 ? '2' : '1'}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          ) : (
            <View style={styles.controlsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.skipBtn}
                onPress={() => triggerCardDecisionWithAnimation(false)}
                accessibilityRole="button"
                accessibilityLabel={
                  currentStep.penaltyForSkip ? 'Пропуск мінус 1' : 'Пропуск'
                }
              >
                <ArrowDown size={18} color={COLORS.textSecondary} />
                <Text style={styles.skipBtnText}>
                  Пропуск{currentStep.penaltyForSkip ? ' −1' : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.guessedBtn}
                onPress={() => triggerCardDecisionWithAnimation(true)}
                accessibilityRole="button"
                accessibilityLabel={`Вгадали плюс ${currentCard?.difficulty === 3 ? '2' : '1'}`}
              >
                <ArrowUp size={20} color={COLORS.background} strokeWidth={2.8} />
                <Text style={styles.guessedBtnText}>
                  ВГАДАЛИ +{currentCard?.difficulty === 3 ? '2' : '1'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      {/* PHASE 5: ROUND RESULT SPLASH + WORD REVIEW */}
      {phase === 'REVIEW' ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.reviewBody}>
          {/* Dramatic Round Result Hero Card */}
          <View style={styles.roundResultHero}>
            <View style={styles.roundResultTopRow}>
              <View>
                <Text style={styles.roundResultOverline}>
                  {roundReactionHeadline}
                </Text>
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

            <View style={styles.roundMetricsRow}>
              <View style={styles.roundMetricPill}>
                <Text style={styles.roundMetricValue}>{guessedWordsCount}</Text>
                <Text style={styles.roundMetricLabel}>Вгадано слів</Text>
              </View>
              <View style={styles.roundMetricPill}>
                <Text style={styles.roundMetricValue}>
                  {roundHistory.length - guessedWordsCount}
                </Text>
                <Text style={styles.roundMetricLabel}>Пропущено</Text>
              </View>
              <View style={styles.roundMetricPill}>
                <Text style={[styles.roundMetricValue, { color: COLORS.hot }]}>
                  {bestStreak} 🔥
                </Text>
                <Text style={styles.roundMetricLabel}>Краща серія</Text>
              </View>
            </View>
          </View>

          <View style={styles.reviewSectionHeader}>
            <Text style={styles.reviewSectionTitle}>
              ПЕРЕВІРКА СЛІВ РАУНДУ ({roundHistory.length})
            </Text>
            <Text style={styles.reviewSectionHint}>
              Натисни, якщо потрібно змінити рішення
            </Text>
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
                  {([-1, 0, (item.isBonus ? 2 : 1)] as (-1 | 0 | 1 | 2)[]).map((pts) => {
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
                  })}
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
                ЗАРАХУВАТИ БАЛИ ТА ПЕРЕДАТИ ХІД →
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.arenaAlias,
  },

  // PHASE 1: READY (TEAM CALLOUT)
  readyBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },
  calloutStageCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    borderTopWidth: 5,
    borderTopColor: COLORS.alias,
    padding: SPACING.xl,
    justifyContent: 'space-between',
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
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  roundBadgeText: {
    color: COLORS.alias,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  teamCurrentScoreText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  calloutHeroCenter: {
    gap: 10,
    paddingVertical: SPACING.lg,
  },
  calloutOverline: {
    color: COLORS.alias,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  calloutTeamName: {
    color: COLORS.textPrimary,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.3,
    lineHeight: 50,
  },
  calloutInstruction: {
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 4,
  },
  calloutRulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  ruleMiniBlock: {
    flex: 1,
    gap: 2,
  },
  ruleMiniDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
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
    width: '100%',
    backgroundColor: COLORS.alias,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipAlias,
    paddingVertical: 17,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  launchButtonSub: {
    color: 'rgba(245, 245, 247, 0.78)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  launchButtonTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // PHASE 2: COUNTDOWN (3 - 2 - 1 - ПОГНАЛИ!)
  countdownBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xxl,
  },
  countdownTeamLabel: {
    color: COLORS.alias,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.2,
    textAlign: 'center',
  },
  countdownCircle: {
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: COLORS.surface,
    borderWidth: 4,
    borderColor: COLORS.alias,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: COLORS.textPrimary,
    fontSize: 106,
    fontWeight: '900',
    letterSpacing: -3.5,
    fontVariant: ['tabular-nums'],
  },
  countdownGoText: {
    color: COLORS.crocodile,
    fontSize: 34,
    letterSpacing: -0.8,
  },
  countdownSubHint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // PHASE 3 & 4: PLAYING & OVERTIME
  playingBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  topHud: {
    gap: 10,
  },
  hudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  hudTeamBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  hudTeamName: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${COLORS.hot}24`,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  streakBadgeText: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  liveScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  liveScoreLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  liveScoreValue: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  overtimeBanner: {
    backgroundColor: '#281319',
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: 2,
  },
  overtimeOverline: {
    color: COLORS.spy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  overtimeTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // CARD STAGE
  cardStage: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: SPACING.md,
    position: 'relative',
  },
  burstBadge: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    zIndex: 30,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  burstBadgeSuccess: {
    backgroundColor: COLORS.crocodile,
  },
  burstBadgeSkip: {
    backgroundColor: COLORS.spy,
  },
  burstBadgeText: {
    color: COLORS.background,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  deepDeckCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 6,
    height: 310,
    backgroundColor: COLORS.cardPaperDeep,
    borderRadius: RADIUS.xl,
    opacity: 0.45,
  },
  backDeckCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 336,
    backgroundColor: COLORS.cardPaperBack,
    borderRadius: RADIUS.xl,
  },
  wordSurface: {
    flex: 1,
    maxHeight: 368,
    backgroundColor: COLORS.cardPaper,
    borderRadius: RADIUS.xl,
    borderBottomWidth: 6,
    borderBottomColor: COLORS.lipPaper,
    padding: SPACING.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  wordSurfaceOvertime: {
    backgroundColor: '#FFF0E6',
    borderWidth: 2,
    borderColor: COLORS.hot,
    borderBottomWidth: 6,
    borderBottomColor: COLORS.lipHot,
  },
  cardFlashOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: RADIUS.xl,
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
    fontVariant: ['tabular-nums'],
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
    letterSpacing: 0.8,
  },
  swipeDownHintText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  wordCenterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  dominantWord: {
    color: COLORS.cardInk,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.4,
    textAlign: 'center',
    lineHeight: 50,
  },
  cardBottomEdge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDeckWatermark: {
    color: COLORS.cardInkMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.75,
  },

  // BOTTOM CONTROLS (TACTILE 3D KEYCAPS)
  controlsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  skipBtn: {
    flex: 1,
    height: 64,
    backgroundColor: COLORS.surfaceElevated,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipNeutral,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  skipBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  guessedBtn: {
    flex: 1.45,
    height: 64,
    backgroundColor: COLORS.crocodile,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipCrocodile,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  guessedBtnText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  // PHASE 5: REVIEW & ROUND RESULT SPLASH
  reviewBody: {
    flex: 1,
    paddingTop: SPACING.xs,
  },
  roundResultHero: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  roundResultTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundResultOverline: {
    color: COLORS.alias,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  roundResultTeam: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  roundResultBigScoreBox: {
    alignItems: 'flex-end',
  },
  roundResultBigScore: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  roundResultScoreUnit: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  roundMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roundMetricPill: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  roundMetricValue: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  roundMetricLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  reviewSectionHeader: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  reviewSectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  reviewSectionHint: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  reviewScroll: {
    flex: 1,
  },
  reviewListContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: 6,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
  },
  reviewWord: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOptionText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewFooter: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  confirmReviewBtn: {
    width: '100%',
    backgroundColor: COLORS.alias,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipAlias,
    height: 60,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmReviewBtnText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  departingGhostCard: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    maxHeight: 368,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  departingGhostSuccess: {
    backgroundColor: '#D1FAE5',
  },
  departingGhostSkip: {
    backgroundColor: '#FFE4E6',
  },
  departingGhostWord: {
    color: COLORS.cardInk,
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
});
