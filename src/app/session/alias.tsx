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
  cancelAnimation,
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
import { getTeamMascot } from '@/constants/mascots';
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
  const teamMascot = getTeamMascot(
    currentTeam.mascotId,
    currentTeam.name,
    currentTeamIndex
  );

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
  const [slotCards, setSlotCards] = useState<
    [{ item: AliasItem; num: number } | null, { item: AliasItem; num: number } | null]
  >([null, null]);
  const [frontSlot, setFrontSlot] = useState<0 | 1>(0);
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
  const [feedbackBurst, setFeedbackBurst] = useState<{
    text: string;
    type: 'success' | 'skip';
  } | null>(null);

  const currentCard = slotCards[frontSlot]?.item ?? null;

  const reducedMotion = useReducedMotion();
  const roundWordIdsRef = useRef<string[]>([]);
  const cardSeqRef = useRef<number>(0);
  const processedSeqRef = useRef<number>(-1);
  const nextCardNumRef = useRef<number>(1);
  const frontSlotRef = useRef<0 | 1>(0);
  const slotCardsRef = useRef<
    [{ item: AliasItem; num: number } | null, { item: AliasItem; num: number } | null]
  >([null, null]);
  const pendingRefillRef = useRef<
    [{ item: AliasItem; num: number } | null, { item: AliasItem; num: number } | null]
  >([null, null]);
  const refillTimersRef = useRef<
    [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]
  >([null, null]);
  const streakRef = useRef<number>(0);
  const isSubmittingRef = useRef<boolean>(false);

  // Synced worklet state for zero-latency gesture handling on UI thread
  const frontSlotSV = useSharedValue<number>(0);
  const phaseSV = useSharedValue<number>(0); // 1 = PLAYING, 2 = OVERTIME
  const isPausedSV = useSharedValue<boolean>(false);
  const reducedMotionSV = useSharedValue<boolean>(false);
  const shakeX = useSharedValue(0);

  const triggerShake = useCallback(() => {
    if (reducedMotion) return;
    shakeX.value = withSequence(
      withTiming(-8, { duration: 40 }),
      withTiming(8, { duration: 45 }),
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(-3, { duration: 40 }),
      withTiming(0, { duration: 40 })
    );
  }, [reducedMotion, shakeX]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  useEffect(() => {
    phaseSV.value = phase === 'PLAYING' ? 1 : phase === 'OVERTIME' ? 2 : 0;
  }, [phase, phaseSV]);

  useEffect(() => {
    isPausedSV.value = isPaused;
  }, [isPaused, isPausedSV]);

  useEffect(() => {
    reducedMotionSV.value = Boolean(reducedMotion);
  }, [reducedMotion, reducedMotionSV]);

  // Persistent two-slot card physics (zero mount flashes, zero center snap)
  const s0Y = useSharedValue(0);
  const s0X = useSharedValue(0);
  const s0Scale = useSharedValue(1);
  const s0Opacity = useSharedValue(1);
  const s0FlashSuccess = useSharedValue(0);
  const s0FlashSkip = useSharedValue(0);
  const s0Z = useSharedValue(10);

  const s1Y = useSharedValue(6);
  const s1X = useSharedValue(0);
  const s1Scale = useSharedValue(0.96);
  const s1Opacity = useSharedValue(1);
  const s1FlashSuccess = useSharedValue(0);
  const s1FlashSkip = useSharedValue(0);
  const s1Z = useSharedValue(5);

  const clearRefillTimers = useCallback(() => {
    for (const idx of [0, 1] as const) {
      if (refillTimersRef.current[idx]) {
        clearTimeout(refillTimersRef.current[idx]!);
        refillTimersRef.current[idx] = null;
      }
    }
  }, []);

  useEffect(() => () => clearRefillTimers(), [clearRefillTimers]);

  // Countdown animation values
  const countdownScale = useSharedValue(0.6);
  const countdownOpacity = useSharedValue(0);

  // Score burst animation values
  const burstOpacity = useSharedValue(0);
  const burstTranslateY = useSharedValue(0);
  const burstScale = useSharedValue(0.7);

  const drawSingleDeckEntry = useCallback((): { item: AliasItem; num: number } | null => {
    const next = drawNextItem(
      deck.id,
      'alias',
      deck.items.alias,
      roundWordIdsRef.current
    );
    if (!next) return null;
    roundWordIdsRef.current = [...roundWordIdsRef.current, next.id];
    const num = nextCardNumRef.current;
    nextCardNumRef.current += 1;
    return { item: next, num };
  }, [deck, drawNextItem]);

  const setSlotPoseImmediate = useCallback(
    (slotIdx: 0 | 1, role: 'front' | 'back') => {
      const ySV = slotIdx === 0 ? s0Y : s1Y;
      const xSV = slotIdx === 0 ? s0X : s1X;
      const scSV = slotIdx === 0 ? s0Scale : s1Scale;
      const opSV = slotIdx === 0 ? s0Opacity : s1Opacity;
      const fsSV = slotIdx === 0 ? s0FlashSuccess : s1FlashSuccess;
      const fkSV = slotIdx === 0 ? s0FlashSkip : s1FlashSkip;
      const zSV = slotIdx === 0 ? s0Z : s1Z;

      cancelAnimation(ySV);
      cancelAnimation(xSV);
      cancelAnimation(scSV);
      cancelAnimation(opSV);
      cancelAnimation(fsSV);
      cancelAnimation(fkSV);

      xSV.value = 0;
      fsSV.value = 0;
      fkSV.value = 0;
      opSV.value = 1;
      ySV.value = role === 'front' ? 0 : 6;
      scSV.value = role === 'front' ? 1 : 0.96;
      zSV.value = role === 'front' ? 10 : 5;
    },
    [
      s0Y, s0X, s0Scale, s0Opacity, s0FlashSuccess, s0FlashSkip, s0Z,
      s1Y, s1X, s1Scale, s1Opacity, s1FlashSuccess, s1FlashSkip, s1Z,
    ]
  );

  const initRoundDeckSlots = useCallback(() => {
    clearRefillTimers();
    pendingRefillRef.current = [null, null];
    nextCardNumRef.current = 1;
    const first = drawSingleDeckEntry();
    const second = drawSingleDeckEntry();
    const nextSlots: [
      { item: AliasItem; num: number } | null,
      { item: AliasItem; num: number } | null,
    ] = [first, second];

    cardSeqRef.current += 1;
    frontSlotRef.current = 0;
    frontSlotSV.value = 0;
    slotCardsRef.current = nextSlots;
    setSlotCards(nextSlots);
    setFrontSlot(0);
    setSlotPoseImmediate(0, 'front');
    setSlotPoseImmediate(1, 'back');
  }, [clearRefillTimers, drawSingleDeckEntry, frontSlotSV, setSlotPoseImmediate]);

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
    clearRefillTimers();
    roundWordIdsRef.current = [];
    cardSeqRef.current = 0;
    processedSeqRef.current = -1;
    nextCardNumRef.current = 1;
    pendingRefillRef.current = [null, null];
    streakRef.current = 0;
    isSubmittingRef.current = false;
    setRoundHistory([]);
    setLastSwipedCard(null);
    setSlotCards([null, null]);
    slotCardsRef.current = [null, null];
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
    clearRefillTimers();
    pendingRefillRef.current = [null, null];
    cardSeqRef.current += 1;

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

    const active = frontSlotRef.current;
    const back = (1 - active) as 0 | 1;
    const restoredEntry = { item: lastSwipedCard, num: nextHistory.length + 1 };
    const updatedSlots: [
      { item: AliasItem; num: number } | null,
      { item: AliasItem; num: number } | null,
    ] = [...slotCardsRef.current] as [
      { item: AliasItem; num: number } | null,
      { item: AliasItem; num: number } | null,
    ];
    updatedSlots[active] = restoredEntry;
    slotCardsRef.current = updatedSlots;
    setSlotCards(updatedSlots);
    setSlotPoseImmediate(active, 'front');
    setSlotPoseImmediate(back, 'back');

    setRoundHistory(nextHistory);
    setLastSwipedCard(null);
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
        initRoundDeckSlots();
        setPhase('PLAYING');
      }
    }, 650);

    return () => clearInterval(interval);
  }, [phase, reducedMotion, countdownScale, countdownOpacity, initRoundDeckSlots]);

  const handleTimerExpire = useCallback(() => {
    triggerShake();
    const nextPhase = currentStep.lastWordForAll === false ? 'REVIEW' : 'OVERTIME';
    setPhase((prev) => (prev === 'PLAYING' ? nextPhase : prev));
  }, [triggerShake, currentStep.lastWordForAll]);

  const commitSlotDecision = useCallback(
    (exitedSlot: 0 | 1, guessed: boolean) => {
      const swipedEntry = slotCardsRef.current[exitedSlot];
      if (
        isPaused ||
        !swipedEntry ||
        exitedSlot !== frontSlotRef.current ||
        processedSeqRef.current === cardSeqRef.current
      ) {
        return;
      }
      processedSeqRef.current = cardSeqRef.current;

      const swipedItem = swipedEntry.item;
      if (guessed) {
        streakRef.current += 1;
        playWordGuessed(streakRef.current);
      } else {
        streakRef.current = 0;
        playWordSkipped();
        if (currentStep.penaltyForSkip) {
          triggerShake();
        }
      }

      const isBonus = swipedItem.difficulty === 3;
      const defaultSkipScore: -1 | 0 = currentStep.penaltyForSkip ? -1 : 0;
      const points: -1 | 0 | 1 | 2 = guessed ? (isBonus ? 2 : 1) : defaultSkipScore;

      triggerFeedbackBurst(guessed, currentStep.penaltyForSkip, isBonus);

      const record: RoundWordRecord = {
        id: `${swipedItem.id}_${Date.now()}`,
        word: swipedItem.word,
        points,
        isBonus,
      };

      setLastSwipedCard(swipedItem);
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
        clearRefillTimers();
        pendingRefillRef.current = [null, null];
        setSlotPoseImmediate(exitedSlot, 'front');
        playVictoryFanfare();
        setPhase('REVIEW');
        return;
      }

      const nextSlot = (1 - exitedSlot) as 0 | 1;

      // Flush any still-pending refill on nextSlot synchronously (handles ultra-fast double-taps)
      if (refillTimersRef.current[nextSlot]) {
        clearTimeout(refillTimersRef.current[nextSlot]!);
        refillTimersRef.current[nextSlot] = null;
      }
      if (pendingRefillRef.current[nextSlot]) {
        const readyEntry = pendingRefillRef.current[nextSlot];
        pendingRefillRef.current[nextSlot] = null;
        const flushedSlots: [
          { item: AliasItem; num: number } | null,
          { item: AliasItem; num: number } | null,
        ] = [...slotCardsRef.current] as [
          { item: AliasItem; num: number } | null,
          { item: AliasItem; num: number } | null,
        ];
        flushedSlots[nextSlot] = readyEntry;
        slotCardsRef.current = flushedSlots;
        setSlotCards(flushedSlots);
        setSlotPoseImmediate(nextSlot, 'front');
      }

      // Advance front slot immediately so the next card is interactive at 0ms
      cardSeqRef.current += 1;
      frontSlotRef.current = nextSlot;
      frontSlotSV.value = nextSlot;
      setFrontSlot(nextSlot);

      // Draw upcoming word for exitedSlot & park it behind frontSlot after exit completes
      const upcoming = drawSingleDeckEntry();
      pendingRefillRef.current[exitedSlot] = upcoming;

      const applyRefill = () => {
        refillTimersRef.current[exitedSlot] = null;
        const refillEntry = pendingRefillRef.current[exitedSlot];
        if (!refillEntry || frontSlotRef.current === exitedSlot) return;
        pendingRefillRef.current[exitedSlot] = null;

        const updatedSlots: [
          { item: AliasItem; num: number } | null,
          { item: AliasItem; num: number } | null,
        ] = [...slotCardsRef.current] as [
          { item: AliasItem; num: number } | null,
          { item: AliasItem; num: number } | null,
        ];
        updatedSlots[exitedSlot] = refillEntry;
        slotCardsRef.current = updatedSlots;
        setSlotCards(updatedSlots);

        requestAnimationFrame(() => {
          if (frontSlotRef.current !== exitedSlot) {
            setSlotPoseImmediate(exitedSlot, 'back');
          }
        });
      };

      if (reducedMotion) {
        applyRefill();
      } else {
        refillTimersRef.current[exitedSlot] = setTimeout(applyRefill, 175);
      }
    },
    [
      isPaused,
      currentStep.penaltyForSkip,
      phase,
      reducedMotion,
      triggerFeedbackBurst,
      clearRefillTimers,
      setSlotPoseImmediate,
      frontSlotSV,
      drawSingleDeckEntry,
      triggerShake,
    ]
  );

  const triggerButtonDecision = useCallback(
    (guessed: boolean) => {
      const active = frontSlotRef.current;
      const next = (1 - active) as 0 | 1;
      if (
        isPaused ||
        !slotCardsRef.current[active] ||
        processedSeqRef.current === cardSeqRef.current
      ) {
        return;
      }

      if (phase === 'PLAYING') {
        const ySV = active === 0 ? s0Y : s1Y;
        const scSV = active === 0 ? s0Scale : s1Scale;
        const opSV = active === 0 ? s0Opacity : s1Opacity;
        const fsSV = active === 0 ? s0FlashSuccess : s1FlashSuccess;
        const fkSV = active === 0 ? s0FlashSkip : s1FlashSkip;
        const zSV = active === 0 ? s0Z : s1Z;

        const nextYSV = next === 0 ? s0Y : s1Y;
        const nextXSV = next === 0 ? s0X : s1X;
        const nextScSV = next === 0 ? s0Scale : s1Scale;
        const nextOpSV = next === 0 ? s0Opacity : s1Opacity;
        const nextZSV = next === 0 ? s0Z : s1Z;

        if (reducedMotion) {
          zSV.value = 5;
          opSV.value = 0;
        } else {
          zSV.value = 20;
          fsSV.value = guessed ? 0.65 : 0;
          fkSV.value = guessed ? 0 : 0.65;
          ySV.value = withTiming(guessed ? -380 : 380, { duration: 165 });
          scSV.value = withTiming(0.96, { duration: 165 });
          opSV.value = withSequence(
            withTiming(1, { duration: 115 }),
            withTiming(0, { duration: 50 })
          );
        }

        nextZSV.value = 10;
        nextXSV.value = 0;
        nextYSV.value = 0;
        nextOpSV.value = 1;
        nextScSV.value = reducedMotion
          ? 1
          : withSpring(1, { damping: 20, stiffness: 320 });
      }

      commitSlotDecision(active, guessed);
    },
    [
      isPaused,
      phase,
      reducedMotion,
      commitSlotDecision,
      s0Y, s0X, s0Scale, s0Opacity, s0FlashSuccess, s0FlashSkip, s0Z,
      s1Y, s1X, s1Scale, s1Opacity, s1FlashSuccess, s1FlashSkip, s1Z,
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled((phase === 'PLAYING' || phase === 'OVERTIME') && !isPaused)
        .activeOffsetY([-10, 10])
        .onUpdate((event) => {
          const active = frontSlotSV.value;
          const isZero = active === 0;
          const ySV = isZero ? s0Y : s1Y;
          const xSV = isZero ? s0X : s1X;
          const scSV = isZero ? s0Scale : s1Scale;
          const fsSV = isZero ? s0FlashSuccess : s1FlashSuccess;
          const fkSV = isZero ? s0FlashSkip : s1FlashSkip;

          const backYSV = isZero ? s1Y : s0Y;
          const backScSV = isZero ? s1Scale : s0Scale;

          ySV.value = event.translationY;
          xSV.value = event.translationX * 0.22;
          const progress = Math.min(1, Math.abs(event.translationY) / 200);
          scSV.value = 1 - progress * 0.03;

          if (event.translationY < 0) {
            fsSV.value = Math.min(0.75, Math.abs(event.translationY) / 140);
            fkSV.value = 0;
          } else {
            fkSV.value = Math.min(0.75, event.translationY / 140);
            fsSV.value = 0;
          }

          if (phaseSV.value === 1) {
            const lift = Math.min(1, Math.abs(event.translationY) / 140);
            backScSV.value = interpolate(lift, [0, 1], [0.96, 1], Extrapolation.CLAMP);
            backYSV.value = interpolate(lift, [0, 1], [6, 0], Extrapolation.CLAMP);
          }
        })
        .onEnd((event) => {
          const active = frontSlotSV.value === 0 ? 0 : 1;
          const isZero = active === 0;
          const ySV = isZero ? s0Y : s1Y;
          const xSV = isZero ? s0X : s1X;
          const scSV = isZero ? s0Scale : s1Scale;
          const opSV = isZero ? s0Opacity : s1Opacity;
          const fsSV = isZero ? s0FlashSuccess : s1FlashSuccess;
          const fkSV = isZero ? s0FlashSkip : s1FlashSkip;
          const zSV = isZero ? s0Z : s1Z;

          const backYSV = isZero ? s1Y : s0Y;
          const backXSV = isZero ? s1X : s0X;
          const backScSV = isZero ? s1Scale : s0Scale;
          const backOpSV = isZero ? s1Opacity : s0Opacity;
          const backZSV = isZero ? s1Z : s0Z;

          const swipedUp = event.translationY < -SWIPE_THRESHOLD;
          const swipedDown = event.translationY > SWIPE_THRESHOLD;

          if (swipedUp || swipedDown) {
            const guessed = swipedUp;
            if (phaseSV.value === 1 && !isPausedSV.value) {
              if (reducedMotionSV.value) {
                zSV.value = 5;
                opSV.value = 0;
              } else {
                // Fly cleanly straight off from exact current position (no center snap!)
                zSV.value = 20;
                fsSV.value = guessed ? 0.65 : 0;
                fkSV.value = guessed ? 0 : 0.65;
                ySV.value = withTiming(guessed ? -380 : 380, { duration: 160 });
                scSV.value = withTiming(0.96, { duration: 160 });
                opSV.value = withSequence(
                  withTiming(1, { duration: 110 }),
                  withTiming(0, { duration: 50 })
                );
              }

              const nextSlot = active === 0 ? 1 : 0;
              frontSlotSV.value = nextSlot;
              backZSV.value = 10;
              backXSV.value = 0;
              backYSV.value = 0;
              backOpSV.value = 1;
              backScSV.value = reducedMotionSV.value
                ? 1
                : withTiming(1, { duration: 130 });
            }
            runOnJS(commitSlotDecision)(active, guessed);
          } else {
            ySV.value = withSpring(0, { damping: 24, stiffness: 280, overshootClamping: true });
            xSV.value = withSpring(0, { damping: 24, stiffness: 280, overshootClamping: true });
            scSV.value = withTiming(1, { duration: 120 });
            fsSV.value = withTiming(0, { duration: 120 });
            fkSV.value = withTiming(0, { duration: 120 });
            if (phaseSV.value === 1) {
              backScSV.value = withTiming(0.96, { duration: 130 });
              backYSV.value = withTiming(6, { duration: 130 });
            }
          }
        }),
    [
      phase,
      isPaused,
      frontSlotSV,
      phaseSV,
      isPausedSV,
      reducedMotionSV,
      commitSlotDecision,
      s0Y, s0X, s0Scale, s0Opacity, s0FlashSuccess, s0FlashSkip, s0Z,
      s1Y, s1X, s1Scale, s1Opacity, s1FlashSuccess, s1FlashSkip, s1Z,
    ]
  );

  const slot0AnimatedStyle = useAnimatedStyle(() => {
    const rotateDeg = interpolate(
      s0X.value,
      [-60, 0, 60],
      [-4, 0, 4],
      Extrapolation.CLAMP
    );
    return {
      opacity: s0Opacity.value,
      zIndex: s0Z.value,
      transform: [
        { translateY: s0Y.value },
        { translateX: s0X.value },
        { scale: s0Scale.value },
        { rotateZ: `${rotateDeg}deg` },
      ],
    };
  });

  const slot1AnimatedStyle = useAnimatedStyle(() => {
    const rotateDeg = interpolate(
      s1X.value,
      [-60, 0, 60],
      [-4, 0, 4],
      Extrapolation.CLAMP
    );
    return {
      opacity: s1Opacity.value,
      zIndex: s1Z.value,
      transform: [
        { translateY: s1Y.value },
        { translateX: s1X.value },
        { scale: s1Scale.value },
        { rotateZ: `${rotateDeg}deg` },
      ],
    };
  });

  const slot0SuccessOverlayStyle = useAnimatedStyle(() => ({
    opacity: s0FlashSuccess.value,
  }));
  const slot0SkipOverlayStyle = useAnimatedStyle(() => ({
    opacity: s0FlashSkip.value,
  }));
  const slot1SuccessOverlayStyle = useAnimatedStyle(() => ({
    opacity: s1FlashSuccess.value,
  }));
  const slot1SkipOverlayStyle = useAnimatedStyle(() => ({
    opacity: s1FlashSkip.value,
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
        label: `👑 +${liveTotal - maxOpponent}`,
        color: COLORS.hot,
      };
    }
    if (liveTotal === maxOpponent && maxOpponent > 0) {
      return {
        label: '⚡ РІВНО',
        color: COLORS.alias,
      };
    }
    if (maxOpponent > liveTotal) {
      return {
        label: `−${maxOpponent - liveTotal} до лідера`,
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
  const isOnFire = currentStreak >= 3 && phase === 'PLAYING';

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
        gameType="alias"
        onPauseChange={setIsPaused}
      />

      <Animated.View style={[{ flex: 1 }, shakeStyle]}>

      {/* PHASE 1: READY (TEAM CALLOUT STAGE) */}
      {phase === 'READY' ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.readyBody}>
          <ScrollView
            style={styles.readyScroll}
            contentContainerStyle={styles.readyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top+Middle Stage Content grouped with intentional rhythm */}
            <View style={styles.readyMainGroup}>
              {/* 1. Team Callout Hero Card */}
              <View style={styles.calloutStageCard}>
                <View style={styles.calloutTopRow}>
                  <View style={styles.roundBadge}>
                    <Zap size={12} color={COLORS.alias} />
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
                  <Text style={styles.calloutTeamName} numberOfLines={2}>
                    {teamMascot.emoji} {currentTeam.name}
                  </Text>
                  <Text style={styles.calloutInstruction}>
                    Ведучий бере телефон і пояснює слова команді на швидкість без
                    спільнокореневих.
                  </Text>
                </View>
              </View>

              {/* 2. Round Parameters, Modifier & Gesture Legend */}
              <View style={styles.readySettingsBlock}>
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

                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={handleCycleModifier}
                  style={[
                    styles.modifierCard,
                    activeModifier && styles.modifierCardActive,
                  ]}
                >
                  <View style={styles.modifierTopRow}>
                    <View style={styles.modifierTitleRow}>
                      <Dices
                        size={14}
                        color={activeModifier ? COLORS.hot : COLORS.textMuted}
                      />
                      <Text
                        style={[
                          styles.modifierTitleText,
                          activeModifier && styles.modifierTitleTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {activeModifier
                          ? `${activeModifier.emoji} ${activeModifier.title} (+1 бал)`
                          : 'Додати умову раунду (+1 бал)'}
                      </Text>
                    </View>
                    <Text style={styles.modifierStatusText}>
                      {activeModifier ? 'Змінити' : 'Вимк'}
                    </Text>
                  </View>
                  {activeModifier ? (
                    <Text style={styles.modifierDescText} numberOfLines={2}>
                      {activeModifier.desc}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <View style={styles.gestureLegendRow}>
                  <View style={styles.gestureLegendItem}>
                    <ArrowUp size={14} color={COLORS.crocodile} strokeWidth={2.6} />
                    <Text style={styles.gestureLegendText}>
                      Вгору — Вгадали (+1)
                    </Text>
                  </View>
                  <View style={styles.gestureLegendDivider} />
                  <View style={styles.gestureLegendItem}>
                    <ArrowDown size={14} color={COLORS.textMuted} strokeWidth={2.4} />
                    <Text style={styles.gestureLegendText}>Вниз — Пропуск</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 3. Primary Launch CTA */}
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.launchButton}
              onPress={handleStartCountdown}
            >
              <Text style={styles.launchButtonSub}>ГОТОВІ?</Text>
              <Text style={styles.launchButtonTitle}>ПОЧАТИ ВІДЛІК 3 · 2 · 1</Text>
            </TouchableOpacity>
          </ScrollView>
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
          {/* Unified Broadcast HUD: Team + Live Score + Dynamic Timer */}
          <View style={styles.topHud}>
            {phase === 'OVERTIME' ? (
              <View style={styles.overtimeBanner}>
                <View style={styles.hudHeaderRow}>
                  <View style={styles.hudTeamBlock}>
                    <Text style={styles.hudTeamName} numberOfLines={1}>
                      {currentTeam.name}
                    </Text>
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
                accentColor={isOnFire ? COLORS.hot : COLORS.alias}
                size="hero"
                headerSlot={
                  <View style={styles.hudHeaderRow}>
                    <View style={styles.hudTeamBlock}>
                      <Text style={styles.hudTeamName} numberOfLines={1}>
                        {teamMascot.emoji} {currentTeam.name}
                      </Text>
                      {currentStreak >= 2 ? (
                        <View style={styles.streakBadge}>
                          <Flame size={12} color={COLORS.hot} />
                          <Text style={styles.streakBadgeText}>
                            {currentStreak} ПІДРЯД
                          </Text>
                        </View>
                      ) : liveChaseStatus ? (
                        <Text
                          style={[
                            styles.chaseInlineText,
                            { color: liveChaseStatus.color },
                          ]}
                          numberOfLines={1}
                        >
                          · {liveChaseStatus.label}
                        </Text>
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
                }
              />
            )}
          </View>

          {/* Clipped Word Card Stage */}
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

            <GestureDetector gesture={panGesture}>
              <View style={styles.cardSlot}>
                {/* Subtle deck rim behind both persistent cards */}
                <View pointerEvents="none" style={styles.underDeckLayer} />

                {([0, 1] as const).map((slotIdx) => {
                  const entry = slotCards[slotIdx];
                  if (!entry) return null;
                  const isFront = frontSlot === slotIdx;
                  const slotAnimStyle =
                    slotIdx === 0 ? slot0AnimatedStyle : slot1AnimatedStyle;
                  const successOverlayStyle =
                    slotIdx === 0
                      ? slot0SuccessOverlayStyle
                      : slot1SuccessOverlayStyle;
                  const skipOverlayStyle =
                    slotIdx === 0
                      ? slot0SkipOverlayStyle
                      : slot1SkipOverlayStyle;

                  return (
                    <Animated.View
                      key={slotIdx}
                      pointerEvents={isFront ? 'auto' : 'none'}
                      style={[
                        styles.wordSurface,
                        styles.wordSurfaceAbsolute,
                        isOnFire && styles.wordSurfaceStreakFire,
                        phase === 'OVERTIME' && styles.wordSurfaceOvertime,
                        slotAnimStyle,
                      ]}
                    >
                      {/* Green Flash Overlay on Guess */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.cardFlashOverlay,
                          styles.cardFlashSuccess,
                          successOverlayStyle,
                        ]}
                      />

                      {/* Crimson Flash Overlay on Skip */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.cardFlashOverlay,
                          styles.cardFlashSkip,
                          skipOverlayStyle,
                        ]}
                      />

                      {/* Top Edge: Index / Bonus Badge & Undo */}
                      <View style={styles.cardTopEdge}>
                        {isOnFire ? (
                          <View style={[styles.cardCounterPill, styles.cardBonusPill]}>
                            <Text style={styles.cardBonusText}>
                              🔥 У ВОГНІ · ×{currentStreak}
                              {entry.item.difficulty === 3 ? ' · БОНУС +2' : ''}
                            </Text>
                          </View>
                        ) : entry.item.difficulty === 3 ? (
                          <View
                            style={[styles.cardCounterPill, styles.cardBonusPill]}
                          >
                            <Text style={styles.cardBonusText}>🔥 БОНУС +2</Text>
                          </View>
                        ) : (
                          <View style={styles.cardCounterPill}>
                            <Text style={styles.cardCounterText}>
                              #{String(entry.num).padStart(2, '0')}
                            </Text>
                          </View>
                        )}

                        {isFront && lastSwipedCard && phase === 'PLAYING' ? (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={handleUndoLastCard}
                            style={[styles.cardCounterPill, styles.cardUndoPill]}
                            accessibilityRole="button"
                            accessibilityLabel="Повернути попереднє слово"
                          >
                            <RotateCcw size={12} color={COLORS.textSecondary} />
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
                                isPaused ? 'ПАУЗА' : entry.item.word
                              ),
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {isPaused ? '⏸ ПАУЗА' : entry.item.word}
                        </Text>
                      </View>

                      {/* Bottom Edge: Subtle Deck & Gesture Anchor */}
                      <View style={styles.cardBottomEdge}>
                        <Text style={styles.cardEdgeCue}>↓ Пропуск</Text>
                        <Text style={styles.cardDeckWatermark} numberOfLines={1}>
                          {deck.title}
                        </Text>
                        <Text
                          style={[styles.cardEdgeCue, { color: COLORS.crocodile }]}
                        >
                          Вгадали ↑
                        </Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </GestureDetector>
          </View>

          {/* Bottom Tactile Action Buttons (or Overtime Steal Panel) */}
          {phase === 'OVERTIME' && teams.length > 1 ? (
            <View style={{ gap: 8 }}>
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.skipBtn}
                  onPress={() => triggerButtonDecision(false)}
                >
                  <ArrowDown size={18} color={COLORS.textSecondary} />
                  <Text style={styles.skipBtnText}>Ніхто не вгадав</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.guessedBtn}
                  onPress={() => triggerButtonDecision(true)}
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
                onPress={() => triggerButtonDecision(false)}
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
                onPress={() => triggerButtonDecision(true)}
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
                <Text style={styles.roundResultTeam}>
                  {teamMascot.emoji} {currentTeam.name}
                </Text>
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
      </Animated.View>
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
  },
  readyScroll: {
    flex: 1,
  },
  readyScrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  readyMainGroup: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.md,
  },
  calloutStageCard: {
    backgroundColor: '#121726',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.24)',
    padding: SPACING.xl,
    gap: SPACING.lg,
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
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  roundBadgeText: {
    color: COLORS.alias,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  teamCurrentScoreText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  calloutHeroCenter: {
    gap: 6,
  },
  calloutOverline: {
    color: COLORS.alias,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  calloutTeamName: {
    color: COLORS.textPrimary,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 44,
  },
  calloutInstruction: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
  },
  readySettingsBlock: {
    gap: 10,
  },
  calloutRulesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
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
  modifierCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    gap: 4,
  },
  modifierCardActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  modifierTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modifierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modifierTitleText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  modifierTitleTextActive: {
    color: COLORS.hot,
  },
  modifierStatusText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  modifierDescText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  gestureLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  gestureLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gestureLegendText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  gestureLegendDivider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.border,
  },
  launchButton: {
    width: '100%',
    backgroundColor: COLORS.alias,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipAlias,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  launchButtonSub: {
    color: 'rgba(245, 245, 247, 0.8)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  launchButtonTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
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
    gap: 8,
  },
  topHud: {
    paddingTop: 2,
  },
  hudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
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
    flexShrink: 1,
  },
  chaseInlineText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${COLORS.hot}24`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  streakBadgeText: {
    color: COLORS.hot,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  liveScoreLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  liveScoreValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  overtimeBanner: {
    backgroundColor: '#241218',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: 6,
  },
  overtimeOverline: {
    color: COLORS.spy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  overtimeTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  // CARD STAGE (clipped so departing card never overlaps HUD)
  cardStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  cardSlot: {
    width: '100%',
    flex: 1,
    maxHeight: 332,
    minHeight: 196,
    position: 'relative',
  },
  burstBadge: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    zIndex: 30,
    paddingHorizontal: 14,
    paddingVertical: 5,
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
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  underDeckLayer: {
    position: 'absolute',
    top: 6,
    left: 10,
    right: 10,
    bottom: -6,
    backgroundColor: '#101524',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.16)',
  },
  wordSurface: {
    flex: 1,
    backgroundColor: '#161C2E',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.30)',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  wordSurfaceAbsolute: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  wordSurfaceOvertime: {
    backgroundColor: '#241712',
    borderColor: COLORS.hot,
  },
  wordSurfaceStreakFire: {
    borderColor: COLORS.hot,
    borderWidth: 2,
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
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
  },
  cardFlashSkip: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
  },
  cardTopEdge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCounterPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  cardCounterText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  cardBonusPill: {
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  cardBonusText: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  cardUndoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardUndoText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  wordCenterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  dominantWord: {
    color: COLORS.textPrimary,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
    textAlign: 'center',
    lineHeight: 50,
  },
  cardBottomEdge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardEdgeCue: {
    color: 'rgba(245, 245, 247, 0.42)',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDeckWatermark: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    flexShrink: 1,
    textAlign: 'center',
  },

  // BOTTOM CONTROLS
  controlsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  skipBtn: {
    flex: 1,
    height: 60,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipNeutral,
    borderRadius: RADIUS.lg,
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
    height: 60,
    backgroundColor: COLORS.crocodile,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipCrocodile,
    borderRadius: RADIUS.lg,
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
});
