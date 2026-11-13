import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { AbsoluteTimer } from '@/components/game/AbsoluteTimer';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { CrocodileItem, CrocodileStep } from '@/types';

type CrocodilePhase = 'READY' | 'PREPARATION' | 'ACTING';

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

  const [phase, setPhase] = useState<CrocodilePhase>('READY');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentPhrase, setCurrentPhrase] = useState<CrocodileItem | null>(null);
  const [swapsRemaining, setSwapsRemaining] = useState<number>(1);
  const [isPeekingSpoiler, setIsPeekingSpoiler] = useState<boolean>(false);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);

  const turnExcludeIdsRef = useRef<string[]>([]);

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

  const handleStartActingTimer = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsPeekingSpoiler(false);
    setIsTimeExpired(false);
    setPhase('ACTING');
  };

  const handleFinishTurn = (guessed: boolean) => {
    if (guessed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const points = guessed ? 2 : 0;
    const phraseText = currentPhrase?.phrase;

    submitTeamTurnResult(points, {
      guessedCount: guessed ? 1 : 0,
      skippedWords: !guessed && phraseText ? [phraseText] : [],
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

      {/* PHASE 1: READY (Leader Handoff) */}
      {phase === 'READY' ? (
        <View style={styles.screenBody}>
          <View style={styles.handoffHeader}>
            <Text style={styles.teamOverline}>{currentTeam.name}</Text>
            <Text style={styles.handoffHeadline}>Обери ведучого</Text>
          </View>

          <View style={styles.handoffCenterBlock}>
            <Text style={styles.handoffNumber}>01</Text>
            <Text style={styles.handoffTitle}>Ведучий бере телефон</Text>
            <Text style={styles.handoffDescription}>
              Побачить фразу, яку потрібно показати команді тільки жестами та мімікою
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.dominantBtn}
            onPress={handleShowPhraseToActor}
          >
            <Text style={styles.dominantBtnText}>Показати завдання</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 2: PREPARATION (Editorial Task View) */}
      {phase === 'PREPARATION' ? (
        <View style={styles.screenBody}>
          <View style={styles.prepMetaRow}>
            <Text style={styles.prepTeamLabel}>{currentTeam.name}</Text>
            <Text style={styles.prepDeckLabel}>{deck.title}</Text>
          </View>

          <View style={styles.prepFocalArea}>
            <Text style={styles.prepHint}>Покажи без слів і звуків</Text>
            <Text style={styles.prepPhraseHero}>
              {currentPhrase?.phrase ?? 'Завантаження...'}
            </Text>

            {swapsRemaining > 0 ? (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.subtleSwapAction}
                onPress={handleSwapPhrase}
                hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              >
                <Text style={styles.subtleSwapText}>Інша фраза ↻</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.swapUsedLabel}>Фразу замінено</Text>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.dominantBtn}
            onPress={handleStartActingTimer}
          >
            <Text style={styles.dominantBtnText}>Почати раунд</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 3: ACTING */}
      {phase === 'ACTING' ? (
        <View style={styles.screenBody}>
          <View style={styles.actingHeader}>
            <Text style={styles.prepTeamLabel}>{currentTeam.name}</Text>
            {isTimeExpired ? (
              <Text style={styles.expiredStatus}>Час вийшов</Text>
            ) : (
              <Text style={styles.prepDeckLabel}>Триває показ</Text>
            )}
          </View>

          <View style={styles.actingCenter}>
            <AbsoluteTimer
              durationSec={currentStep.roundTimeSec}
              isRunning={!isPaused && !isTimeExpired}
              onExpire={() => setIsTimeExpired(true)}
              accentColor={COLORS.crocodile}
              size="large"
            />

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
              {isPeekingSpoiler ? (
                <Text style={styles.peekRevealedText}>
                  {currentPhrase?.phrase}
                </Text>
              ) : (
                <Text style={styles.peekPromptText}>
                  Утримуй, щоб підглянути фразу
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.actingActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.dominantBtn}
              onPress={() => handleFinishTurn(true)}
            >
              <Text style={styles.dominantBtnText}>Вгадали  +2</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.secondaryBtn}
              onPress={() => handleFinishTurn(false)}
            >
              <Text style={styles.secondaryBtnText}>Пропустити</Text>
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
  screenBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
  },

  // READY (Leader Handoff)
  handoffHeader: {
    gap: 4,
  },
  teamOverline: {
    color: COLORS.crocodile,
    fontSize: 14,
    fontWeight: '600',
  },
  handoffHeadline: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  handoffCenterBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    gap: SPACING.sm,
  },
  handoffNumber: {
    color: COLORS.crocodile,
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
  handoffDescription: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },

  // PREPARATION
  prepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prepTeamLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  prepDeckLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  prepFocalArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xl,
  },
  prepHint: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  prepPhraseHero: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtleSwapAction: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  subtleSwapText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  swapUsedLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },

  // ACTING
  actingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expiredStatus: {
    color: COLORS.spy,
    fontSize: 13,
    fontWeight: '600',
  },
  actingCenter: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.xxl,
  },
  peekSurface: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    minHeight: 136,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekSurfaceActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  peekPromptText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  peekRevealedText: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 29,
    textAlign: 'center',
  },
  actingActions: {
    gap: SPACING.sm,
  },

  // Shared Buttons
  dominantBtn: {
    width: '100%',
    backgroundColor: COLORS.crocodile,
    paddingVertical: 17,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dominantBtnText: {
    color: COLORS.background,
    fontSize: 17,
    fontWeight: '700',
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
