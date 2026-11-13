import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
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
import { HoldToRevealCard } from '@/components/game/HoldToRevealCard';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { baseUaDeck, useDeckStore } from '@/stores/useDeckStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { useUsedContentStore } from '@/stores/useUsedContentStore';
import { SpyLocation, SpyStep } from '@/types';

type SpyPhase = 'ROLE_DISTRIBUTION' | 'DISCUSSION' | 'RESOLUTION';

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
  const [isTruthRevealed, setIsTruthRevealed] = useState<boolean>(false);

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
    setIsTruthRevealed(false);
    setPhase('ROLE_DISTRIBUTION');
  }, [activeDeck, currentStep.id, currentStep.spyCount, playerCount, drawNextItem]);

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

  const handleGoToResolution = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setIsTruthRevealed(false);
    setPhase('RESOLUTION');
  };

  const handleRevealTruth = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsTruthRevealed(true);
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
            <Text style={styles.playerOverline}>
              ГРАВЕЦЬ {playerNumStr} З {totalPlayersStr}
            </Text>
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
                  ? 'Почати обговорення'
                  : `Передати Гравцю №${currentPlayerIndex + 2}`
                : 'Утримуй картку для перегляду'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 2: DISCUSSION */}
      {phase === 'DISCUSSION' ? (
        <View style={styles.discussionBody}>
          <View style={styles.discussionTop}>
            <View style={styles.discussionMetaRow}>
              <Text style={styles.discussionLabel}>Обговорення</Text>
              <Text style={styles.discussionSpyCount}>
                Шпигунів: {spyIndices.length}
              </Text>
            </View>

            <AbsoluteTimer
              durationSec={currentStep.discussionTimeSec}
              isRunning={phase === 'DISCUSSION' && !isPaused}
              onExpire={handleGoToResolution}
              accentColor={COLORS.spy}
              size="compact"
            />
          </View>

          <View style={styles.locationsSection}>
            <Text style={styles.locationsHeaderLabel}>
              Можливі локації ({activeDeck.items.spyLocations.length})
            </Text>

            <ScrollView
              style={styles.locationsScroll}
              contentContainerStyle={styles.locationsGrid}
              showsVerticalScrollIndicator={false}
            >
              {activeDeck.items.spyLocations.map((loc) => (
                <View key={loc.id} style={styles.locationItem}>
                  <Text style={styles.locationItemText} numberOfLines={1}>
                    {loc.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryBtn}
            onPress={handleGoToResolution}
          >
            <Text style={styles.primaryBtnText}>Дострокове голосування</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 3: RESOLUTION */}
      {phase === 'RESOLUTION' ? (
        <View style={styles.resolutionBody}>
          {!isTruthRevealed ? (
            <>
              <View style={styles.resolutionHeader}>
                <Text style={styles.playerOverline}>ГОЛОСУВАННЯ</Text>
                <Text style={styles.passHeadline}>Хто Шпигун?</Text>
              </View>

              <View style={styles.resolutionCenterCard}>
                <Text style={styles.resolutionNumber}>03</Text>
                <Text style={styles.resolutionPromptTitle}>
                  Покажіть на підозрюваного
                </Text>
                <Text style={styles.resolutionPromptSub}>
                  На рахунок «три» всі гравці одночасно вказують на того, кого вважають шпигуном.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.primaryBtn}
                onPress={handleRevealTruth}
              >
                <Text style={styles.primaryBtnText}>Розкрити правду</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.resolutionHeader}>
                <Text style={styles.playerOverline}>РЕЗУЛЬТАТ ПАРТІЇ</Text>
                <Text style={styles.passHeadline}>Маски знято</Text>
              </View>

              <View style={styles.truthSurface}>
                <View style={styles.truthBlock}>
                  <Text style={styles.truthCaption}>
                    {spyIndices.length === 1 ? 'ШПИГУН' : 'ШПИГУНИ'}
                  </Text>
                  <Text style={styles.truthSpyHero}>
                    {spyIndices.map((idx) => `Гравець №${idx + 1}`).join(', ')}
                  </Text>
                </View>

                <View style={styles.truthDivider} />

                <View style={styles.truthBlock}>
                  <Text style={styles.truthCaption}>ЗАГАДАНА ЛОКАЦІЯ</Text>
                  <Text style={styles.truthLocationHero}>
                    {secretLocation?.name}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.primaryBtn}
                onPress={handleFinishSpyStep}
              >
                <Text style={styles.primaryBtnText}>
                  {currentStepIndex + 1 < steps.length
                    ? 'Наступний раунд'
                    : 'Завершити партію'}
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
    gap: 4,
  },
  playerOverline: {
    color: COLORS.spy,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  passHeadline: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: COLORS.spy,
    paddingVertical: 17,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.surface,
  },
  primaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryBtnTextDisabled: {
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // DISCUSSION
  discussionBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },
  discussionTop: {
    gap: SPACING.xs,
  },
  discussionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discussionLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  discussionSpyCount: {
    color: COLORS.spy,
    fontSize: 13,
    fontWeight: '600',
  },
  locationsSection: {
    flex: 1,
    gap: SPACING.sm,
  },
  locationsHeaderLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  locationsScroll: {
    flex: 1,
  },
  locationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  locationItem: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  locationItemText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },

  // RESOLUTION
  resolutionBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  resolutionHeader: {
    gap: 4,
  },
  resolutionCenterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    gap: SPACING.sm,
  },
  resolutionNumber: {
    color: COLORS.spy,
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginBottom: 4,
  },
  resolutionPromptTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  resolutionPromptSub: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  truthSurface: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    gap: SPACING.xl,
  },
  truthBlock: {
    gap: 6,
  },
  truthCaption: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  truthSpyHero: {
    color: COLORS.spy,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  truthDivider: {
    height: 1,
    backgroundColor: '#262532',
  },
  truthLocationHero: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
