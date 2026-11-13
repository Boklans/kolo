import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
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
import { Eye, RefreshCw, Sparkles } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { AbsoluteTimer } from '@/components/game/AbsoluteTimer';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { CrocodileItem, CrocodileStep } from '@/types';

type CrocodilePhase = 'READY' | 'PREPARATION' | 'COUNTDOWN' | 'ACTING' | 'RESULT';

export default function CrocodileGameScreen() {
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
    if (raw && raw.gameType === 'crocodile') {
      return raw as CrocodileStep;
    }
    return {
      id: 'fallback_crocodile',
      deckId: 'base_ua',
      gameType: 'crocodile',
      roundTimeSec: 60,
      roundsPerTeam: 1,
      scoring: { type: 'team', groupId: 'main' },
    } as CrocodileStep;
  }, [steps, currentStepIndex]);

  const deck = useMemo(() => {
    const found = getDeckById(currentStep.deckId);
    if (found && found.items.crocodile.length > 0) {
      return found;
    }
    return baseUaDeck;
  }, [getDeckById, currentStep.deckId]);

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

  const [phase, setPhase] = useState<CrocodilePhase>('READY');
  const [countdownLabel, setCountdownLabel] = useState<string>('3');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentPhrase, setCurrentPhrase] = useState<CrocodileItem | null>(null);
  const [swapsRemaining, setSwapsRemaining] = useState<number>(1);
  const [isPeekingSpoiler, setIsPeekingSpoiler] = useState<boolean>(false);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);
  const [turnGuessed, setTurnGuessed] = useState<boolean>(false);

  const turnExcludeIdsRef = useRef<string[]>([]);

  const countdownScale = useSharedValue(0.6);
  const countdownOpacity = useSharedValue(0);

  const pullNextPhrase = useCallback(() => {
    const item = drawNextItem(
      deck.id,
      'crocodile',
      deck.items.crocodile,
      turnExcludeIdsRef.current
    );
    if (item) {
      turnExcludeIdsRef.current = [...turnExcludeIdsRef.current, item.id];
      setCurrentPhrase(item);
    }
  }, [deck, drawNextItem]);

  const handleShowPhraseToActor = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    turnExcludeIdsRef.current = [];
    setSwapsRemaining(1);
    setIsTimeExpired(false);
    pullNextPhrase();
    setPhase('PREPARATION');
  };

  const handleSwapPhrase = () => {
    if (swapsRemaining <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSwapsRemaining(0);
    pullNextPhrase();
  };

  const handleStartCountdown = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsPeekingSpoiler(false);
    setIsTimeExpired(false);
    setCountdownLabel('3');
    setPhase('COUNTDOWN');
  };

  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;

    const sequence = ['3', '2', '1', 'МОТОР!'];
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    };

    animateBeat(sequence[0], false);

    const interval = setInterval(() => {
      stepIdx += 1;
      if (stepIdx < sequence.length) {
        animateBeat(sequence[stepIdx], stepIdx === sequence.length - 1);
      } else {
        clearInterval(interval);
        setPhase('ACTING');
      }
    }, 650);

    return () => clearInterval(interval);
  }, [phase, countdownScale, countdownOpacity]);

  const animatedCountdownStyle = useAnimatedStyle(() => ({
    opacity: countdownOpacity.value,
    transform: [{ scale: countdownScale.value }],
  }));

  const handleFinishTurn = (guessed: boolean) => {
    if (guessed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setTurnGuessed(guessed);
    setPhase('RESULT');
  };

  const handleConfirmAndNextTeam = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const points = turnGuessed ? 2 : 0;
    const phraseText = currentPhrase?.phrase;

    submitTeamTurnResult(points, {
      guessedCount: turnGuessed ? 1 : 0,
      skippedWords: !turnGuessed && phraseText ? [phraseText] : [],
    });

    router.replace('/session/scoreboard');
  };

  const stepNumStr = String(currentStepIndex + 1).padStart(2, '0');
  const totalStepsStr = String(Math.max(1, steps.length)).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`КРОКОДИЛ · ${stepNumStr} / ${totalStepsStr}`}
        rightMetaText={`${currentStep.roundTimeSec} СЕК`}
        accentColor={COLORS.crocodile}
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: READY (Leader Callout Stage) */}
      {phase === 'READY' ? (
        <View style={styles.screenBody}>
          <View style={styles.calloutStageCard}>
            <View style={styles.calloutTopRow}>
              <View style={styles.roundBadge}>
                <Sparkles size={13} color={COLORS.crocodile} />
                <Text style={styles.roundBadgeText}>
                  РАУНД {currentRoundInStep} З {currentStep.roundsPerTeam}
                </Text>
              </View>
              <Text style={styles.teamCurrentScoreText}>
                Рахунок: {currentTeamTotalScore}
              </Text>
            </View>

            <View style={styles.calloutHeroCenter}>
              <Text style={styles.calloutOverline}>ЧАС ПАНТОМІМИ</Text>
              <Text style={styles.calloutTeamName}>{currentTeam.name}</Text>
              <Text style={styles.calloutInstruction}>
                Оберіть актора з команди. Тільки він бере телефон і дивиться
                секретну фразу!
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
                <Text style={styles.ruleMiniLabel}>НАГОРОДА</Text>
                <Text style={[styles.ruleMiniValue, { color: COLORS.crocodile }]}>
                  +2 бали за фразу
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.dominantBtn}
            onPress={handleShowPhraseToActor}
          >
            <Text style={styles.dominantBtnSub}>ТЕЛЕФОН У РУКАХ ВЕДУЧОГО</Text>
            <Text style={styles.dominantBtnText}>ПОКАЗАТИ ЗАВДАННЯ</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 2: PREPARATION (Secret Task Card) */}
      {phase === 'PREPARATION' ? (
        <View style={styles.screenBody}>
          <View style={styles.prepMetaRow}>
            <Text style={styles.prepTeamLabel}>{currentTeam.name}</Text>
            <Text style={styles.prepDeckLabel}>Тільки для очей ведучого</Text>
          </View>

          <View style={styles.prepCardSurface}>
            <Text style={styles.prepHint}>ПОКАЖИ БЕЗ СЛІВ І ЗВУКІВ</Text>
            <Text
              style={styles.prepPhraseHero}
              adjustsFontSizeToFit
              numberOfLines={4}
            >
              {currentPhrase?.phrase ?? 'Завантаження...'}
            </Text>

            {swapsRemaining > 0 ? (
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.subtleSwapAction}
                onPress={handleSwapPhrase}
                hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              >
                <RefreshCw size={14} color={COLORS.textSecondary} />
                <Text style={styles.subtleSwapText}>Замінити фразу (1 раз)</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.swapUsedLabel}>Заміну використано</Text>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.dominantBtn}
            onPress={handleStartCountdown}
          >
            <Text style={styles.dominantBtnSub}>ЗАПАМ’ЯТАВ ФРАЗУ?</Text>
            <Text style={styles.dominantBtnText}>ПОЧАТИ ВІДЛІК 3 · 2 · 1</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 3: COUNTDOWN (3 - 2 - 1 - МОТОР!) */}
      {phase === 'COUNTDOWN' ? (
        <View style={styles.countdownBody}>
          <Text style={styles.countdownTeamLabel}>
            {currentTeam.name.toUpperCase()} · УСІ ОЧІ НА ВЕДУЧОГО!
          </Text>
          <Animated.View
            style={[styles.countdownCircle, animatedCountdownStyle]}
          >
            <Text
              style={[
                styles.countdownNumber,
                countdownLabel === 'МОТОР!' && styles.countdownGoText,
              ]}
            >
              {countdownLabel}
            </Text>
          </Animated.View>
          <Text style={styles.countdownSubHint}>
            Жодних слів, звуків чи рухів губами
          </Text>
        </View>
      ) : null}

      {/* PHASE 4: ACTING */}
      {phase === 'ACTING' ? (
        <View style={styles.screenBody}>
          <View style={styles.actingTopBlock}>
            <View style={styles.actingHeader}>
              <Text style={styles.prepTeamLabel}>{currentTeam.name}</Text>
              {isTimeExpired ? (
                <Text style={styles.expiredStatus}>ЧАС ВИЙШОВ!</Text>
              ) : (
                <Text style={styles.prepDeckLabel}>Триває показ (+2 бали)</Text>
              )}
            </View>

            <AbsoluteTimer
              durationSec={currentStep.roundTimeSec}
              isRunning={!isPaused && !isTimeExpired}
              onExpire={() => setIsTimeExpired(true)}
              accentColor={COLORS.crocodile}
              size="hero"
            />
          </View>

          <View style={styles.actingCenter}>
            <Pressable
              onPressIn={() => {
                Haptics.selectionAsync();
                setIsPeekingSpoiler(true);
              }}
              onPressOut={() => setIsPeekingSpoiler(false)}
              style={[
                styles.peekSurface,
                isPeekingSpoiler && styles.peekSurfaceActive,
              ]}
            >
              <Eye
                size={22}
                color={isPeekingSpoiler ? COLORS.crocodile : COLORS.textMuted}
              />
              {isPeekingSpoiler ? (
                <Text style={styles.peekRevealedText}>
                  {currentPhrase?.phrase}
                </Text>
              ) : (
                <Text style={styles.peekPromptText}>
                  Забув завдання? Утримуй палець тут, щоб підглянути
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.actingActions}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.dominantBtn}
              onPress={() => handleFinishTurn(true)}
            >
              <Text style={styles.dominantBtnText}>КОМАНДА ВГАДАЛА!  +2</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.secondaryBtn}
              onPress={() => handleFinishTurn(false)}
            >
              <Text style={styles.secondaryBtnText}>Не вгадали · 0 балів</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* PHASE 5: ROUND RESULT SPLASH */}
      {phase === 'RESULT' ? (
        <View style={styles.screenBody}>
          <View
            style={[
              styles.resultHeroCard,
              turnGuessed ? styles.resultCardSuccess : styles.resultCardMissed,
            ]}
          >
            <Text
              style={[
                styles.resultOverline,
                { color: turnGuessed ? COLORS.crocodile : COLORS.spy },
              ]}
            >
              {turnGuessed ? 'БРАВО АКТОРУ! 👏' : 'СЬОГОДНІ БЕЗ ОСКАРА'}
            </Text>

            <Text style={styles.resultPointsGiant}>
              {turnGuessed ? '+2 БАЛИ' : '0 БАЛІВ'}
            </Text>

            <Text style={styles.resultTeamName}>{currentTeam.name}</Text>

            <View style={styles.resultPhraseBox}>
              <Text style={styles.resultPhraseLabel}>ЗАГАДАНА ФРАЗА</Text>
              <Text style={styles.resultPhraseValue}>
                «{currentPhrase?.phrase}»
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.dominantBtn}
            onPress={handleConfirmAndNextTeam}
          >
            <Text style={styles.dominantBtnText}>
              ДАЛІ · ПЕРЕДАТИ ХІД НАСТУПНІЙ КОМАНДІ →
            </Text>
          </TouchableOpacity>
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
  screenBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },

  // PHASE 1: READY (Leader Callout Stage)
  calloutStageCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
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
    backgroundColor: `${COLORS.crocodile}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  roundBadgeText: {
    color: COLORS.crocodile,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  teamCurrentScoreText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  calloutHeroCenter: {
    gap: 10,
    paddingVertical: SPACING.lg,
  },
  calloutOverline: {
    color: COLORS.crocodile,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  calloutTeamName: {
    color: COLORS.textPrimary,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 48,
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
    backgroundColor: COLORS.surfaceElevated,
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

  // PHASE 2: PREPARATION
  prepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prepTeamLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  prepDeckLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  prepCardSurface: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prepHint: {
    color: COLORS.crocodile,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  prepPhraseHero: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtleSwapAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
  },
  subtleSwapText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  swapUsedLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },

  // PHASE 3: COUNTDOWN
  countdownBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xxl,
  },
  countdownTeamLabel: {
    color: COLORS.crocodile,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  countdownCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: COLORS.textPrimary,
    fontSize: 96,
    fontWeight: '900',
    letterSpacing: -3,
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

  // PHASE 4: ACTING
  actingTopBlock: {
    gap: 10,
  },
  actingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expiredStatus: {
    color: COLORS.spy,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actingCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  peekSurface: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    minHeight: 200,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  peekSurfaceActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  peekPromptText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  peekRevealedText: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    textAlign: 'center',
  },
  actingActions: {
    gap: 10,
  },

  // PHASE 5: RESULT SPLASH
  resultHeroCard: {
    flex: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  resultCardSuccess: {
    backgroundColor: '#13241E',
  },
  resultCardMissed: {
    backgroundColor: COLORS.surface,
  },
  resultOverline: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  resultPointsGiant: {
    color: COLORS.textPrimary,
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -1.8,
  },
  resultTeamName: {
    color: COLORS.textSecondary,
    fontSize: 20,
    fontWeight: '700',
  },
  resultPhraseBox: {
    marginTop: SPACING.lg,
    width: '100%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  resultPhraseLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  resultPhraseValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Shared Buttons
  dominantBtn: {
    width: '100%',
    backgroundColor: COLORS.crocodile,
    paddingVertical: 18,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dominantBtnSub: {
    color: 'rgba(16, 16, 20, 0.68)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  dominantBtnText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: COLORS.surface,
    paddingVertical: 15,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
