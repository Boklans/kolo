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
import { ArrowDown, ArrowUp, Ban, Flame, RotateCcw, ShieldAlert } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { getTeamMascot } from '@/constants/mascots';
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

  const [phase, setPhase] = useState<TabooPhase>('READY');
  const [countdownLabel, setCountdownLabel] = useState<string>('3');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [slotCards, setSlotCards] = useState<
    [{ item: TabooItem; num: number } | null, { item: TabooItem; num: number } | null]
  >([null, null]);
  const [frontSlot, setFrontSlot] = useState<0 | 1>(0);
  const [lastSwipedCard, setLastSwipedCard] = useState<TabooItem | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundWordRecord[]>([]);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
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
    [{ item: TabooItem; num: number } | null, { item: TabooItem; num: number } | null]
  >([null, null]);
  const pendingRefillRef = useRef<
    [{ item: TabooItem; num: number } | null, { item: TabooItem; num: number } | null]
  >([null, null]);
  const refillTimersRef = useRef<
    [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]
  >([null, null]);
  const streakRef = useRef<number>(0);
  const isSubmittingRef = useRef<boolean>(false);

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

  const countdownScale = useSharedValue(0.6);
  const countdownOpacity = useSharedValue(0);

  const burstOpacity = useSharedValue(0);
  const burstTranslateY = useSharedValue(0);
  const burstScale = useSharedValue(0.7);

  const drawSingleDeckEntry = useCallback((): { item: TabooItem; num: number } | null => {
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
      { item: TabooItem; num: number } | null,
      { item: TabooItem; num: number } | null,
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
    [reducedMotion, burstOpacity, burstScale, burstTranslateY]
  );

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
      { item: TabooItem; num: number } | null,
      { item: TabooItem; num: number } | null,
    ] = [...slotCardsRef.current] as [
      { item: TabooItem; num: number } | null,
      { item: TabooItem; num: number } | null,
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

    const sequence = ['3', '2', '1', 'БЕЗ ТАБУ!'];
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
    setPhase((prev) => (prev === 'PLAYING' ? 'OVERTIME' : prev));
  }, [triggerShake]);

  const commitSlotDecision = useCallback(
    (exitedSlot: 0 | 1, outcome: 'guessed' | 'skip' | 'taboo') => {
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
      if (outcome === 'guessed') {
        streakRef.current += 1;
        playWordGuessed(streakRef.current);
      } else {
        streakRef.current = 0;
        playWordSkipped();
        if (outcome === 'taboo' && currentStep.penaltyForTaboo) {
          triggerShake();
        }
      }

      const isBonus = swipedItem.difficulty === 3;
      const points: -1 | 0 | 1 | 2 =
        outcome === 'guessed'
          ? isBonus
            ? 2
            : 1
          : outcome === 'taboo' && currentStep.penaltyForTaboo
            ? -1
            : 0;

      triggerFeedbackBurst(outcome, isBonus);

      const record: RoundWordRecord = {
        id: `${swipedItem.id}_${Date.now()}`,
        word: swipedItem.word,
        points,
        isBonus,
      };

      setLastSwipedCard(swipedItem);
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
        clearRefillTimers();
        pendingRefillRef.current = [null, null];
        setSlotPoseImmediate(exitedSlot, 'front');
        playVictoryFanfare();
        setPhase('REVIEW');
        return;
      }

      const nextSlot = (1 - exitedSlot) as 0 | 1;

      if (refillTimersRef.current[nextSlot]) {
        clearTimeout(refillTimersRef.current[nextSlot]!);
        refillTimersRef.current[nextSlot] = null;
      }
      if (pendingRefillRef.current[nextSlot]) {
        const readyEntry = pendingRefillRef.current[nextSlot];
        pendingRefillRef.current[nextSlot] = null;
        const flushedSlots: [
          { item: TabooItem; num: number } | null,
          { item: TabooItem; num: number } | null,
        ] = [...slotCardsRef.current] as [
          { item: TabooItem; num: number } | null,
          { item: TabooItem; num: number } | null,
        ];
        flushedSlots[nextSlot] = readyEntry;
        slotCardsRef.current = flushedSlots;
        setSlotCards(flushedSlots);
        setSlotPoseImmediate(nextSlot, 'front');
      }

      cardSeqRef.current += 1;
      frontSlotRef.current = nextSlot;
      frontSlotSV.value = nextSlot;
      setFrontSlot(nextSlot);

      const upcoming = drawSingleDeckEntry();
      pendingRefillRef.current[exitedSlot] = upcoming;

      const applyRefill = () => {
        refillTimersRef.current[exitedSlot] = null;
        const refillEntry = pendingRefillRef.current[exitedSlot];
        if (!refillEntry || frontSlotRef.current === exitedSlot) return;
        pendingRefillRef.current[exitedSlot] = null;

        const updatedSlots: [
          { item: TabooItem; num: number } | null,
          { item: TabooItem; num: number } | null,
        ] = [...slotCardsRef.current] as [
          { item: TabooItem; num: number } | null,
          { item: TabooItem; num: number } | null,
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
      currentStep.penaltyForTaboo,
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
    (outcome: 'guessed' | 'skip' | 'taboo') => {
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
          fsSV.value = outcome === 'guessed' ? 0.65 : 0;
          fkSV.value = outcome === 'guessed' ? 0 : 0.65;
          ySV.value = withTiming(outcome === 'guessed' ? -420 : 420, { duration: 165 });
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

      commitSlotDecision(active, outcome);
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
            const outcome = swipedUp ? 'guessed' : 'skip';
            if (phaseSV.value === 1 && !isPausedSV.value) {
              if (reducedMotionSV.value) {
                zSV.value = 5;
                opSV.value = 0;
              } else {
                zSV.value = 20;
                fsSV.value = outcome === 'guessed' ? 0.65 : 0;
                fkSV.value = outcome === 'guessed' ? 0 : 0.65;
                ySV.value = withTiming(outcome === 'guessed' ? -420 : 420, { duration: 160 });
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
            runOnJS(commitSlotDecision)(active, outcome);
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
  const isOnFire = currentStreak >= 3 && phase === 'PLAYING';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`ТАБУ · ${stepNumStr} / ${totalStepsStr}`}
        rightMetaText={`${currentStep.roundTimeSec} СЕК`}
        accentColor={COLORS.taboo}
        gameType="taboo"
        onPauseChange={setIsPaused}
      />

      <Animated.View style={[{ flex: 1 }, shakeStyle]}>

      {/* PHASE 1: READY */}
      {phase === 'READY' ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(180)}
          style={styles.readyBody}
        >
          <ScrollView
            style={styles.readyScroll}
            contentContainerStyle={styles.readyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.readyMainGroup}>
              <View style={styles.calloutStageCard}>
                <View style={styles.calloutTopRow}>
                  <View style={styles.roundBadge}>
                    <ShieldAlert size={12} color={COLORS.taboo} />
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
                  <Text style={styles.calloutTeamName} numberOfLines={2}>
                    {teamMascot.emoji} {currentTeam.name}
                  </Text>
                  <Text style={styles.calloutInstruction}>
                    Поясни головне слово, НЕ називаючи 4 заборонені слова під ним!
                    Суперник стежить через плече.
                  </Text>
                </View>
              </View>

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
                    <Text style={styles.ruleMiniLabel}>СКАЗАВ ТАБУ-СЛОВО</Text>
                    <Text style={[styles.ruleMiniValue, { color: COLORS.spy }]}>
                      {currentStep.penaltyForTaboo ? 'Штраф −1 бал' : 'Пропуск (0)'}
                    </Text>
                  </View>
                </View>

                <View style={styles.gestureLegendRow}>
                  <View style={styles.gestureLegendItem}>
                    <ArrowUp size={14} color={COLORS.crocodile} strokeWidth={2.6} />
                    <Text style={styles.gestureLegendText}>Вгору — Вгадали</Text>
                  </View>
                  <View style={styles.gestureLegendDivider} />
                  <View style={styles.gestureLegendItem}>
                    <ArrowDown size={14} color={COLORS.textMuted} strokeWidth={2.4} />
                    <Text style={styles.gestureLegendText}>Вниз — Пас</Text>
                  </View>
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
          </ScrollView>
        </Animated.View>
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
            {phase === 'OVERTIME' ? (
              <View style={styles.overtimeBanner}>
                <View style={styles.hudHeaderRow}>
                  <Text style={styles.hudTeamName} numberOfLines={1}>
                    {currentTeam.name}
                  </Text>
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
                accentColor={isOnFire ? COLORS.hot : COLORS.taboo}
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

          {/* Clipped 2-Slot Taboo Card Stage */}
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
              <View style={styles.cardSlot}>
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
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.cardFlashOverlay,
                          styles.cardFlashSuccess,
                          successOverlayStyle,
                        ]}
                      />
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.cardFlashOverlay,
                          styles.cardFlashSkip,
                          skipOverlayStyle,
                        ]}
                      />

                      <View style={styles.cardTopEdge}>
                        {isOnFire ? (
                          <View style={[styles.cardCounterPill, styles.cardBonusPill]}>
                            <Text style={styles.cardBonusText}>
                              🔥 У ВОГНІ · ×{currentStreak}
                              {entry.item.difficulty === 3 ? ' · БОНУС +2' : ''}
                            </Text>
                          </View>
                        ) : entry.item.difficulty === 3 ? (
                          <View style={[styles.cardCounterPill, styles.cardBonusPill]}>
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

                      {/* Forbidden Words Danger Zone */}
                      <View style={styles.tabooZone}>
                        <View style={styles.tabooZoneHeader}>
                          <Ban size={12} color="#FDA4AF" />
                          <Text style={styles.tabooZoneOverline}>
                            ЗАБОРОНЕНІ СЛОВА
                          </Text>
                        </View>
                        <View style={styles.tabooWordsGrid}>
                          {(isPaused ? [] : entry.item.forbiddenWords ?? []).map(
                            (fw, idx) => (
                              <View key={idx} style={styles.tabooWordPill}>
                                <Text
                                  style={styles.tabooWordText}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                >
                                  {fw}
                                </Text>
                              </View>
                            )
                          )}
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            </GestureDetector>
          </View>

          {/* 3-Button Action Row: Skip (0), Taboo (-1), Guessed (+1/+2) */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.skipBtn}
              onPress={() => triggerButtonDecision('skip')}
            >
              <ArrowDown size={16} color={COLORS.textSecondary} />
              <Text style={styles.skipBtnText}>Пас (0)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.tabooPenaltyBtn}
              onPress={() => triggerButtonDecision('taboo')}
            >
              <Ban size={15} color={COLORS.textPrimary} />
              <Text style={styles.tabooPenaltyBtnText}>ТАБУ −1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.guessedBtn}
              onPress={() => triggerButtonDecision('guessed')}
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
      </Animated.View>
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
    backgroundColor: '#161026',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.28)',
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
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  roundBadgeText: {
    color: COLORS.taboo,
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
    color: COLORS.taboo,
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
    backgroundColor: COLORS.taboo,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipTaboo,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 2,
  },
  launchButtonSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  launchButtonTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.4,
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
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
    borderColor: 'rgba(249, 115, 22, 0.35)',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    gap: 6,
  },
  overtimeOverline: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  overtimeTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  cardSlot: {
    width: '100%',
    flex: 1,
    maxHeight: 380,
    minHeight: 240,
    position: 'relative',
  },
  underDeckLayer: {
    position: 'absolute',
    top: 6,
    left: 10,
    right: 10,
    bottom: -6,
    backgroundColor: '#120D1E',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.16)',
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
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  wordSurface: {
    flex: 1,
    backgroundColor: '#181228',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.32)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
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
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dominantWord: {
    color: COLORS.textPrimary,
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1.2,
  },
  tabooZone: {
    backgroundColor: '#24101A',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.28)',
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    gap: 8,
  },
  tabooZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabooZoneOverline: {
    color: '#FDA4AF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  tabooWordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tabooWordPill: {
    width: '48.8%',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.22)',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabooWordText: {
    color: '#FFE4E6',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skipBtn: {
    flex: 0.9,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipNeutral,
    borderRadius: RADIUS.lg,
  },
  skipBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  tabooPenaltyBtn: {
    flex: 1,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.spy,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipSpy,
    borderRadius: RADIUS.lg,
  },
  tabooPenaltyBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  guessedBtn: {
    flex: 1.3,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.crocodile,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipCrocodile,
    borderRadius: RADIUS.lg,
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
