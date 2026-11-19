import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Dices, Eye, EyeOff, RefreshCw, Sparkles } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { AbsoluteTimer } from '@/components/game/AbsoluteTimer';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { CrocodileItem, CrocodileStep } from '@/types';
import {
  playCountdownBeep,
  playCountdownGo,
  playVictoryFanfare,
  playWordGuessed,
  playWordSkipped,
  triggerHaptic,
} from '@/utils/sound';

type CrocodilePhase = 'READY' | 'PREPARATION' | 'COUNTDOWN' | 'ACTING' | 'RESULT';

const CROCODILE_MODIFIERS = [
  {
    id: 'slowmo',
    emoji: '🐢',
    title: 'Матриця (Slow-Mo)',
    desc: 'Показуй завдання у максимально сповільненій зйомці (+1 бонусний бал)',
  },
  {
    id: 'sitting',
    emoji: '🪑',
    title: 'Сидячий Оскар',
    desc: 'Покажи завдання, не встаючи зі стільця (+1 бонусний бал)',
  },
  {
    id: 'mime_only',
    emoji: '😐',
    title: 'Тільки мімікою',
    desc: 'Руки за спиною — показуй тільки обличчям і головою (+1 бонусний бал)',
  },
  {
    id: 'dance',
    emoji: '🕺',
    title: 'Танцювальна пантоміма',
    desc: 'Показуй завдання, постійно пританцьовуючи (+1 бонусний бал)',
  },
];

export default function CrocodileGameScreen() {
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
    const found = resolveStepDeck(currentStep.deckId, currentStep.deckIds, currentStep.minDifficulty);
    if (found && found.items.crocodile.length > 0) {
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

  const [phase, setPhase] = useState<CrocodilePhase>('READY');
  const [countdownLabel, setCountdownLabel] = useState<string>('3');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentPhrase, setCurrentPhrase] = useState<CrocodileItem | null>(null);
  const [swapsRemaining, setSwapsRemaining] = useState<number>(1);
  const [isPeekingSpoiler, setIsPeekingSpoiler] = useState<boolean>(false);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);
  const [turnGuessed, setTurnGuessed] = useState<boolean>(false);
  const [activeModifierIdx, setActiveModifierIdx] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  const activeModifier =
    activeModifierIdx !== null ? CROCODILE_MODIFIERS[activeModifierIdx] : null;

  const handleCycleModifier = () => {
    triggerHaptic('selection');
    setActiveModifierIdx((prev) => {
      if (prev === null) {
        return Math.floor(Math.random() * CROCODILE_MODIFIERS.length);
      }
      const next = prev + 1;
      if (next >= CROCODILE_MODIFIERS.length) return null;
      return next;
    });
  };

  const turnExcludeIdsRef = useRef<string[]>([]);
  const isSubmittingRef = useRef<boolean>(false);

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
    triggerHaptic('medium');
    turnExcludeIdsRef.current = [];
    isSubmittingRef.current = false;
    setSwapsRemaining(1);
    setIsTimeExpired(false);
    pullNextPhrase();
    setPhase('PREPARATION');
  };

  const handleSwapPhrase = () => {
    if (swapsRemaining <= 0) return;
    triggerHaptic('light');
    setSwapsRemaining(0);
    pullNextPhrase();
  };

  const handleStartCountdown = () => {
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
        setPhase('ACTING');
      }
    }, 650);

    return () => clearInterval(interval);
  }, [phase, reducedMotion, countdownScale, countdownOpacity]);

  const animatedCountdownStyle = useAnimatedStyle(() => ({
    opacity: countdownOpacity.value,
    transform: [{ scale: countdownScale.value }],
  }));

  const handleFinishTurn = (guessed: boolean) => {
    if (guessed) {
      playWordGuessed(3);
    } else {
      playWordSkipped();
    }

    setTurnGuessed(guessed);
    setPhase('RESULT');
  };

  const isBonusPhrase = currentPhrase?.difficulty === 3;
  const targetPoints = (isBonusPhrase ? 3 : 2) + (activeModifier ? 1 : 0);

  const handleConfirmAndNextTeam = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    triggerHaptic('success');
    const points = turnGuessed ? targetPoints : 0;
    const phraseText = currentPhrase?.phrase;

    submitTeamTurnResult(points, {
      guessedCount: turnGuessed ? 1 : 0,
      bonusGuessedCount: turnGuessed && isBonusPhrase ? 1 : 0,
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
        gameType="crocodile"
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: READY (Leader Callout Stage) */}
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
                    <Sparkles size={12} color={COLORS.crocodile} />
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
                  <Text style={styles.calloutTeamName} numberOfLines={2}>
                    {currentTeam.name}
                  </Text>
                  <Text style={styles.calloutInstruction}>
                    Оберіть актора з команди. Тільки він бере телефон і дивиться
                    секретну фразу!
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
                    <Text style={styles.ruleMiniLabel}>НАГОРОДА</Text>
                    <Text style={[styles.ruleMiniValue, { color: COLORS.crocodile }]}>
                      +2–3 бали за слово
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
                        color={activeModifier ? COLORS.crocodile : COLORS.textMuted}
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
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* PHASE 2: PREPARATION (Secret Task Card) */}
      {phase === 'PREPARATION' ? (
        <View style={styles.screenBody}>
          <View style={styles.prepMetaRow}>
            <Text style={styles.prepTeamLabel}>{currentTeam.name}</Text>
            <Text style={styles.prepDeckLabel}>Тільки для очей ведучого</Text>
          </View>

          <View style={styles.prepCenterStage}>
            <View style={styles.prepCardSurface}>
              <Text style={styles.prepHint}>
                {isBonusPhrase
                  ? '🔥 ХАРДКОР 3★ (+3 БАЛИ) · ПОКАЖИ БЕЗ СЛІВ'
                  : 'ПОКАЖИ БЕЗ СЛІВ І ЗВУКІВ (+2 БАЛИ)'}
              </Text>
              <Text
                style={styles.prepPhraseHero}
                adjustsFontSizeToFit
                numberOfLines={4}
              >
                {isPaused ? '⏸ ПАУЗА · ПРИХОВАНО' : currentPhrase?.phrase ?? 'Завантаження...'}
              </Text>

              {swapsRemaining > 0 && !isPaused ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.subtleSwapAction}
                  onPress={handleSwapPhrase}
                  hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                  accessibilityRole="button"
                  accessibilityLabel="Замінити слово"
                >
                  <RefreshCw size={14} color={COLORS.textSecondary} />
                  <Text style={styles.subtleSwapText}>Замінити слово (1 раз)</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.swapUsedLabel}>
                  {isPaused ? 'Натисни «Продовжити» в меню паузи' : 'Заміну використано'}
                </Text>
              )}
            </View>
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
          <View style={styles.actingHeader}>
            <Text style={styles.prepTeamLabel}>{currentTeam.name}</Text>
            {isTimeExpired ? (
              <Text style={styles.expiredStatus}>ЧАС ВИЙШОВ!</Text>
            ) : (
              <Text style={styles.prepDeckLabel}>
                Зараз на сцені · +{targetPoints} бали
              </Text>
            )}
          </View>

          <View style={styles.actingCenter}>
            {activeModifier ? (
              <View style={styles.activeModifierPill}>
                <Text style={styles.activeModifierText}>
                  {activeModifier.emoji} {activeModifier.title}: {activeModifier.desc}
                </Text>
              </View>
            ) : null}

            <AbsoluteTimer
              durationSec={currentStep.roundTimeSec}
              isRunning={!isPaused && !isTimeExpired}
              onExpire={() => setIsTimeExpired(true)}
              accentColor={COLORS.crocodile}
              size="stage"
            />

            <Pressable
              onPressIn={() => {
                if (isPaused) return;
                triggerHaptic('selection');
                setIsPeekingSpoiler(true);
              }}
              onPressOut={() => setIsPeekingSpoiler(false)}
              style={[
                styles.peekSurface,
                isPeekingSpoiler && !isPaused && styles.peekSurfaceActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Утримуй, щоб підглянути секретне слово"
            >
              {isPaused ? (
                <View style={styles.peekInlineRow}>
                  <EyeOff size={18} color={COLORS.textMuted} />
                  <Text style={styles.peekPromptText}>
                    ПАУЗА · СЛОВО ПРИХОВАНО
                  </Text>
                </View>
              ) : isPeekingSpoiler ? (
                <Text style={styles.peekRevealedText}>
                  {currentPhrase?.phrase}
                </Text>
              ) : (
                <View style={styles.peekInlineRow}>
                  <Eye size={18} color={COLORS.crocodile} />
                  <Text style={styles.peekPromptText}>
                    Забув слово? Натисни й тримай тут
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.actingActions}>
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.dominantBtn}
              onPress={() => handleFinishTurn(true)}
              accessibilityRole="button"
              accessibilityLabel={`Команда вгадала, плюс ${targetPoints} бали`}
            >
              <Text style={styles.dominantBtnText}>
                КОМАНДА ВГАДАЛА!  +{targetPoints}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.secondaryBtn}
              onPress={() => handleFinishTurn(false)}
              accessibilityRole="button"
              accessibilityLabel="Не вгадали, 0 балів"
            >
              <Text style={styles.secondaryBtnText}>Не вгадали · 0 балів</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* PHASE 5: ROUND RESULT SPLASH */}
      {phase === 'RESULT' ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(180)}
          style={styles.screenBody}
        >
          <View style={styles.resultCenterStage}>
            <View
              style={[
                styles.resultHeroCard,
                turnGuessed ? styles.resultCardSuccess : styles.resultCardMissed,
              ]}
            >
              <View style={styles.resultTopBadge}>
                <Text
                  style={[
                    styles.resultOverline,
                    { color: turnGuessed ? COLORS.crocodile : COLORS.spy },
                  ]}
                >
                  {turnGuessed ? 'БРАВО АКТОРУ!' : 'ЧАС ВИЙШОВ'}
                </Text>
              </View>

              <View style={styles.resultScoreCenter}>
                <Text style={styles.resultPointsGiant}>
                  {turnGuessed ? `+${targetPoints}` : '0'}
                </Text>
                <Text style={styles.resultPointsUnit}>
                  {turnGuessed ? 'БАЛІВ У ЗАЛІК' : 'БАЛІВ'}
                </Text>
                <Text style={styles.resultTeamName}>{currentTeam.name}</Text>
              </View>

              <View style={styles.resultPhraseBox}>
                <Text style={styles.resultPhraseLabel}>СЛОВО РАУНДУ</Text>
                <Text style={styles.resultPhraseValue}>
                  «{currentPhrase?.phrase}»
                </Text>
                {turnGuessed && activeModifier ? (
                  <Text style={styles.resultModifierBonus}>
                    {activeModifier.emoji} Бонус за умову (+1 бал)
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.dominantBtn}
            onPress={handleConfirmAndNextTeam}
            accessibilityRole="button"
            accessibilityLabel="Далі, наступна команда"
          >
            <Text style={styles.dominantBtnText}>
              ДАЛІ · НАСТУПНА КОМАНДА →
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.arenaCrocodile,
  },
  screenBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
    gap: SPACING.md,
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
    backgroundColor: '#0E1F19',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
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
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  roundBadgeText: {
    color: COLORS.crocodile,
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
    color: COLORS.crocodile,
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
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
    color: COLORS.crocodile,
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

  // PHASE 2: PREPARATION
  prepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prepTeamLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  prepDeckLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  prepCenterStage: {
    flex: 1,
    justifyContent: 'center',
  },
  prepCardSurface: {
    width: '100%',
    minHeight: 220,
    maxHeight: 330,
    flex: 1,
    backgroundColor: '#0E1F19',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.30)',
    padding: SPACING.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prepHint: {
    color: COLORS.crocodile,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textAlign: 'center',
  },
  prepPhraseHero: {
    color: COLORS.textPrimary,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
    letterSpacing: -1.1,
    textAlign: 'center',
  },
  subtleSwapAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  subtleSwapText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  swapUsedLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
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
    borderColor: COLORS.crocodile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: COLORS.textPrimary,
    fontSize: 104,
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
    gap: SPACING.md,
  },
  activeModifierPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  activeModifierText: {
    color: COLORS.crocodile,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  peekSurface: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: RADIUS.lg,
    minHeight: 76,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekSurfaceActive: {
    backgroundColor: '#122B22',
    borderColor: COLORS.crocodile,
  },
  peekInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  peekPromptText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  peekRevealedText: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
    textAlign: 'center',
  },
  actingActions: {
    gap: 10,
  },

  // PHASE 5: RESULT SPLASH
  resultCenterStage: {
    flex: 1,
    justifyContent: 'center',
  },
  resultHeroCard: {
    width: '100%',
    flex: 1,
    maxHeight: 370,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.24)',
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultCardSuccess: {
    backgroundColor: '#13241E',
  },
  resultCardMissed: {
    backgroundColor: COLORS.surface,
  },
  resultTopBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  resultOverline: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  resultScoreCenter: {
    alignItems: 'center',
    gap: 4,
  },
  resultPointsGiant: {
    color: COLORS.textPrimary,
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2.2,
    fontVariant: ['tabular-nums'],
  },
  resultPointsUnit: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: SPACING.sm,
  },
  resultTeamName: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  resultPhraseBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  resultModifierBonus: {
    color: COLORS.crocodile,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
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
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipCrocodile,
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dominantBtnSub: {
    color: 'rgba(16, 16, 20, 0.72)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  dominantBtnText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipNeutral,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
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
