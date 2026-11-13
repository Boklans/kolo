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
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  MapPin,
  Search,
  Sparkles,
  Users,
} from 'lucide-react-native';
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

  // Якщо в обраній колоді немає локацій — беремо з base_ua
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

  // Ініціалізація партії при монтуванні
  useEffect(() => {
    const chosenLocation =
      drawNextItem(
        activeDeck.id,
        'spyLocations',
        activeDeck.items.spyLocations
      ) ?? activeDeck.items.spyLocations[0];

    setSecretLocation(chosenLocation ?? null);

    // Обираємо індекси шпигунів
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`ШПИГУН • КРОК ${currentStepIndex + 1}/${Math.max(1, steps.length)}`}
        accentColor={COLORS.spy}
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: ROLE_DISTRIBUTION */}
      {phase === 'ROLE_DISTRIBUTION' ? (
        <View style={styles.distributionContainer}>
          <View style={styles.passHeader}>
            <View style={styles.playerProgressPill}>
              <Users size={15} color={COLORS.spy} />
              <Text style={styles.playerProgressText}>
                РОЗДАЧА РОЛЕЙ • ГРАВЕЦЬ {currentPlayerIndex + 1} З {playerCount}
              </Text>
            </View>
            <Text style={styles.passTitle}>
              Гравець №{currentPlayerIndex + 1}, візьми телефон
            </Text>
            <Text style={styles.passSubtitle}>
              Переконайся, що ніхто інший не заглядає в екран
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

          <View style={styles.distributionFooter}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!hasSeenRole}
              style={[
                styles.nextPlayerBtn,
                !hasSeenRole && styles.nextPlayerBtnDisabled,
              ]}
              onPress={handleNextPlayerOrStartDiscussion}
            >
              {hasSeenRole ? (
                <>
                  <Text style={styles.nextPlayerBtnText}>
                    {isLastPlayer
                      ? 'Почати обговорення!'
                      : `Я запам'ятав — передати Гравцю №${currentPlayerIndex + 2}`}
                  </Text>
                  <ArrowRight size={20} color={COLORS.textPrimary} />
                </>
              ) : (
                <>
                  <Lock size={18} color={COLORS.textSecondary} />
                  <Text style={styles.nextPlayerBtnTextDisabled}>
                    Затисни картку на 1 сек, щоб побачити роль
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* PHASE 2: DISCUSSION */}
      {phase === 'DISCUSSION' ? (
        <View style={styles.discussionContainer}>
          <View style={styles.discussionTop}>
            <Text style={styles.discussionTitle}>Покладіть телефон на стіл</Text>
            <Text style={styles.discussionSubtitle}>
              Ставте одне одному запитання по колу. Шпигун серед вас ({spyIndices.length}{' '}
              {spyIndices.length === 1 ? 'шпигун' : 'шпигуни'})!
            </Text>

            <AbsoluteTimer
              durationSec={currentStep.discussionTimeSec}
              isRunning={phase === 'DISCUSSION' && !isPaused}
              onExpire={handleGoToResolution}
              accentColor={COLORS.spy}
            />
          </View>

          <View style={styles.locationsGridSection}>
            <View style={styles.locationsGridHeader}>
              <MapPin size={15} color={COLORS.primary} />
              <Text style={styles.locationsGridTitle}>
                Усі можливі локації колоди «{activeDeck.title}» ({activeDeck.items.spyLocations.length}):
              </Text>
            </View>

            <ScrollView
              style={styles.locationsScroll}
              contentContainerStyle={styles.locationsChipsWrap}
              showsVerticalScrollIndicator={false}
            >
              {activeDeck.items.spyLocations.map((loc) => (
                <View key={loc.id} style={styles.locationChip}>
                  <MapPin size={12} color={COLORS.textSecondary} />
                  <Text style={styles.locationChipText}>{loc.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.discussionFooter}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.earlyVoteBtn}
              onPress={handleGoToResolution}
            >
              <Search size={19} color={COLORS.textPrimary} />
              <Text style={styles.earlyVoteBtnText}>
                Голосувати достроково / Розкрити карти
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* PHASE 3: RESOLUTION */}
      {phase === 'RESOLUTION' ? (
        <View style={styles.resolutionContainer}>
          {!isTruthRevealed ? (
            <View style={styles.intrigueCard}>
              <View style={styles.intrigueIconCircle}>
                <EyeOff size={42} color={COLORS.spy} />
              </View>

              <Text style={styles.intrigueTag}>МОМЕНТ ІСТИНИ</Text>
              <Text style={styles.intrigueTitle}>Час на обговорення вийшов!</Text>
              <Text style={styles.intrigueSubtitle}>
                На рахунок «ТРИ» кожен гравець одночасно показує пальцем на того, кого вважає Шпигуном!
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.revealTruthBtn}
                onPress={handleRevealTruth}
              >
                <Eye size={20} color={COLORS.textPrimary} />
                <Text style={styles.revealTruthBtnText}>Показати правду</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.truthCard}>
              <View style={styles.truthBadge}>
                <Sparkles size={15} color={COLORS.hot} />
                <Text style={styles.truthBadgeText}>СЕКРЕТ РОЗКРИТО</Text>
              </View>

              <Text style={styles.spyRevealLabel}>
                {spyIndices.length === 1 ? 'ШПИГУНОМ БУВ:' : 'ШПИГУНАМИ БУЛИ:'}
              </Text>
              <Text style={styles.spyRevealValue}>
                {spyIndices.map((idx) => `Гравець №${idx + 1}`).join(' та ')}!
              </Text>

              <View style={styles.trueLocationBox}>
                <Text style={styles.trueLocationLabel}>СПРАВЖНЯ ЛОКАЦІЯ:</Text>
                <Text style={styles.trueLocationValue}>
                  📍 {secretLocation?.name}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.finishStepBtn}
                onPress={handleFinishSpyStep}
              >
                <Text style={styles.finishStepBtnText}>
                  {currentStepIndex + 1 < steps.length
                    ? 'Перейти до наступного раунду'
                    : 'Завершити партію'}
                </Text>
                <ArrowRight size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
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
  distributionContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  passHeader: {
    alignItems: 'center',
    gap: 4,
  },
  playerProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.spy}20`,
    borderWidth: 1,
    borderColor: `${COLORS.spy}66`,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginBottom: 4,
  },
  playerProgressText: {
    color: COLORS.spy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  passTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  passSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  distributionFooter: {
    width: '100%',
  },
  nextPlayerBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 17,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  nextPlayerBtnDisabled: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nextPlayerBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  nextPlayerBtnTextDisabled: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },

  // Discussion
  discussionContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  discussionTop: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  discussionTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  discussionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  locationsGridSection: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  locationsGridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationsGridTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  locationsScroll: {
    flex: 1,
  },
  locationsChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
    paddingBottom: SPACING.md,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  locationChipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  discussionFooter: {
    width: '100%',
  },
  earlyVoteBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.spy,
    paddingVertical: 17,
    borderRadius: RADIUS.lg,
  },
  earlyVoteBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },

  // Resolution
  resolutionContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intrigueCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: `${COLORS.spy}88`,
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  intrigueIconCircle: {
    width: 82,
    height: 82,
    borderRadius: RADIUS.full,
    backgroundColor: `${COLORS.spy}20`,
    borderWidth: 1.5,
    borderColor: COLORS.spy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  intrigueTag: {
    color: COLORS.spy,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  intrigueTitle: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  intrigueSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  revealTruthBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.spy,
    paddingVertical: 17,
    borderRadius: RADIUS.lg,
  },
  revealTruthBtnText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  truthCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: `${COLORS.primary}88`,
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  truthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.hot}22`,
    borderWidth: 1,
    borderColor: `${COLORS.hot}66`,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.lg,
  },
  truthBadgeText: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  spyRevealLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  spyRevealValue: {
    color: COLORS.spy,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  trueLocationBox: {
    width: '100%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.crocodile}66`,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  trueLocationLabel: {
    color: COLORS.crocodile,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  trueLocationValue: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  finishStepBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 17,
    borderRadius: RADIUS.lg,
  },
  finishStepBtnText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
});
