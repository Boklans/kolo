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
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Play,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from 'lucide-react-native';
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

const SWIPE_THRESHOLD = 85;

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

  // Анімаційні значення для свайпу картки
  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);

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
    }
  }, [deck, drawNextItem]);

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
      translateY.value = 0;
      cardScale.value = 1;

      // Якщо це була остання картка в OVERTIME -> переходимо у REVIEW
      if (phase === 'OVERTIME') {
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
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(phase === 'PLAYING' || phase === 'OVERTIME')
        .onUpdate((event) => {
          translateY.value = event.translationY;
          const progress = Math.min(1, Math.abs(event.translationY) / 200);
          cardScale.value = 1 - progress * 0.04;
        })
        .onEnd((event) => {
          if (event.translationY < -SWIPE_THRESHOLD) {
            // Свайп вгору -> Вгадали (+1)
            translateY.value = withTiming(-320, { duration: 140 }, () => {
              runOnJS(handleCardDecision)(true);
            });
          } else if (event.translationY > SWIPE_THRESHOLD) {
            // Свайп вниз -> Пропуск
            translateY.value = withTiming(320, { duration: 140 }, () => {
              runOnJS(handleCardDecision)(false);
            });
          } else {
            translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
            cardScale.value = withSpring(1);
          }
        }),
    [phase, handleCardDecision, translateY, cardScale]
  );

  const animatedCardStyle = useAnimatedStyle(() => {
    const borderCol =
      translateY.value < -35
        ? COLORS.crocodile
        : translateY.value > 35
          ? COLORS.spy
          : phase === 'OVERTIME'
            ? COLORS.spy
            : `${COLORS.alias}88`;

    return {
      transform: [{ translateY: translateY.value }, { scale: cardScale.value }],
      borderColor: borderCol,
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SessionTopBar
        stepBadgeText={`ЕЛІАС • КРОК ${currentStepIndex + 1}/${Math.max(1, steps.length)}`}
        accentColor={COLORS.alias}
        onPauseChange={setIsPaused}
      />

      {/* PHASE 1: READY */}
      {phase === 'READY' ? (
        <View style={styles.readyContainer}>
          <View style={styles.teamBadgeLarge}>
            <Users size={22} color={COLORS.alias} />
            <Text style={styles.teamBadgeLabel}>ГОТУЄТЬСЯ КОМАНДА</Text>
          </View>

          <Text style={styles.teamNameHero}>{currentTeam.name}</Text>
          <Text style={styles.roundSubtitle}>
            Раунд {currentRoundInStep} з {currentStep.roundsPerTeam} • Колода:{' '}
            {deck.emoji} {deck.title}
          </Text>

          <View style={styles.rulesCard}>
            <View style={styles.ruleRow}>
              <Sparkles size={18} color={COLORS.alias} />
              <Text style={styles.ruleText}>
                Пояснюй слова на швидкість без однокореневих підказок та перекладів.
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <ArrowUp size={18} color={COLORS.crocodile} />
              <Text style={styles.ruleText}>
                Свайп вгору або зелена кнопка —{' '}
                <Text style={{ color: COLORS.crocodile, fontWeight: '800' }}>
                  Вгадали (+1)
                </Text>
              </Text>
            </View>
            <View style={styles.ruleRow}>
              <ArrowDown size={18} color={COLORS.spy} />
              <Text style={styles.ruleText}>
                Свайп вниз або пропуск —{' '}
                <Text style={{ color: COLORS.spy, fontWeight: '800' }}>
                  {currentStep.penaltyForSkip
                    ? 'Штраф (-1 бал)'
                    : 'Без штрафу (0 балів)'}
                </Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.startRoundBtn}
            onPress={handleStartRound}
          >
            <Play size={22} color={COLORS.textPrimary} fill={COLORS.textPrimary} />
            <Text style={styles.startRoundBtnText}>
              Почати раунд ({currentStep.roundTimeSec} сек)
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* PHASE 2 & 3: PLAYING & OVERTIME */}
      {phase === 'PLAYING' || phase === 'OVERTIME' ? (
        <View style={styles.playingContainer}>
          {/* Top Status / Timer */}
          <View style={styles.timerHeader}>
            <View style={styles.liveScoreRow}>
              <Text style={styles.liveTeamName}>{currentTeam.name}</Text>
              <View style={styles.liveScoreBadge}>
                <Text style={styles.liveScoreText}>
                  Бали за раунд: {totalRoundPoints >= 0 ? `+${totalRoundPoints}` : totalRoundPoints}
                </Text>
              </View>
            </View>

            {phase === 'OVERTIME' ? (
              <View style={styles.overtimeBanner}>
                <AlertCircle size={18} color={COLORS.spy} />
                <Text style={styles.overtimeBannerText}>
                  ЧАС ВИЙШОВ! Дограйте останню картку
                </Text>
              </View>
            ) : (
              <AbsoluteTimer
                durationSec={currentStep.roundTimeSec}
                isRunning={phase === 'PLAYING' && !isPaused}
                onExpire={handleTimerExpire}
                accentColor={COLORS.alias}
              />
            )}
          </View>

          {/* Swipe Hints & Word Card */}
          <View style={styles.arenaCenter}>
            <View style={styles.swipeHintTop}>
              <ArrowUp size={15} color={COLORS.crocodile} />
              <Text style={[styles.swipeHintText, { color: COLORS.crocodile }]}>
                СВАЙП ВГОРУ — ВГАДАЛИ (+1)
              </Text>
            </View>

            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.wordCard, animatedCardStyle]}>
                {phase === 'OVERTIME' ? (
                  <View style={styles.overtimeTag}>
                    <Text style={styles.overtimeTagText}>ОСТАННЄ СЛОВО</Text>
                  </View>
                ) : (
                  <Text style={styles.cardCounterText}>
                    Картка #{roundHistory.length + 1}
                  </Text>
                )}

                <Text style={styles.wordText}>
                  {currentCard?.word ?? 'Готово!'}
                </Text>

                <Text style={styles.deckSubTag}>
                  {deck.emoji} {deck.title}
                </Text>
              </Animated.View>
            </GestureDetector>

            <View style={styles.swipeHintBottom}>
              <ArrowDown size={15} color={COLORS.textSecondary} />
              <Text style={styles.swipeHintText}>
                СВАЙП ВНИЗ — ПРОПУСК ({currentStep.penaltyForSkip ? '-1' : '0'})
              </Text>
            </View>
          </View>

          {/* Bottom Duplicate One-Handed Buttons */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.skipButton}
              onPress={() => handleCardDecision(false)}
            >
              <X size={22} color={COLORS.spy} />
              <Text style={styles.skipButtonText}>
                Пропуск ({currentStep.penaltyForSkip ? '-1' : '0'})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.guessedButton}
              onPress={() => handleCardDecision(true)}
            >
              <Check size={22} color={COLORS.textPrimary} />
              <Text style={styles.guessedButtonText}>Вгадали (+1)</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* PHASE 4: REVIEW */}
      {phase === 'REVIEW' ? (
        <View style={styles.reviewContainer}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewTitle}>Підсумки раунду</Text>
            <Text style={styles.reviewSubtitle}>
              Перевірте слова команди «{currentTeam.name}». Якщо був випадковий свайп — змініть бал:
            </Text>
          </View>

          <ScrollView
            style={styles.reviewList}
            contentContainerStyle={styles.reviewListContent}
            showsVerticalScrollIndicator={false}
          >
            {roundHistory.map((item) => (
              <View key={item.id} style={styles.reviewItemRow}>
                <Text style={styles.reviewWordText} numberOfLines={2}>
                  {item.word}
                </Text>

                <View style={styles.segmentedControl}>
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
                          styles.segmentBtn,
                          active && {
                            backgroundColor: activeBg,
                            borderColor: activeBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.segmentBtnText,
                            active && { color: COLORS.textPrimary },
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
            <View style={styles.reviewSummaryRow}>
              <Text style={styles.reviewTotalLabel}>Сума за цей раунд:</Text>
              <Text
                style={[
                  styles.reviewTotalValue,
                  {
                    color:
                      totalRoundPoints > 0
                        ? COLORS.crocodile
                        : totalRoundPoints < 0
                          ? COLORS.spy
                          : COLORS.textPrimary,
                  },
                ]}
              >
                {totalRoundPoints > 0 ? `+${totalRoundPoints}` : totalRoundPoints} балів
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.confirmReviewBtn}
              onPress={handleConfirmReview}
            >
              <CheckCircle2 size={20} color={COLORS.textPrimary} />
              <Text style={styles.confirmReviewBtnText}>
                Підтвердити та передати хід
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
    backgroundColor: COLORS.background,
  },
  readyContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${COLORS.alias}20`,
    borderWidth: 1,
    borderColor: `${COLORS.alias}66`,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  teamBadgeLabel: {
    color: COLORS.alias,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  teamNameHero: {
    color: COLORS.textPrimary,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  roundSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: SPACING.xxl,
    textAlign: 'center',
  },
  rulesCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    gap: SPACING.md,
    marginBottom: SPACING.xxxl,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  ruleText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  startRoundBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.alias,
    paddingVertical: 18,
    borderRadius: RADIUS.lg,
  },
  startRoundBtnText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },

  // Playing & Overtime
  playingContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  timerHeader: {
    gap: SPACING.sm,
  },
  liveScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveTeamName: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  liveScoreBadge: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  liveScoreText: {
    color: COLORS.alias,
    fontSize: 13,
    fontWeight: '800',
  },
  overtimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${COLORS.spy}25`,
    borderWidth: 1.5,
    borderColor: COLORS.spy,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  overtimeBannerText: {
    color: COLORS.spy,
    fontSize: 15,
    fontWeight: '900',
  },
  arenaCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },
  swipeHintTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swipeHintBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swipeHintText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  wordCard: {
    width: '100%',
    minHeight: 250,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 2.5,
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overtimeTag: {
    backgroundColor: `${COLORS.spy}28`,
    borderWidth: 1,
    borderColor: COLORS.spy,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  overtimeTagText: {
    color: COLORS.spy,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardCounterText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  wordText: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 40,
  },
  deckSubTag: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  skipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1.5,
    borderColor: `${COLORS.spy}66`,
    paddingVertical: 18,
    borderRadius: RADIUS.lg,
  },
  skipButtonText: {
    color: COLORS.spy,
    fontSize: 16,
    fontWeight: '800',
  },
  guessedButton: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.crocodile,
    paddingVertical: 18,
    borderRadius: RADIUS.lg,
  },
  guessedButtonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },

  // Review Phase
  reviewContainer: {
    flex: 1,
    paddingTop: SPACING.sm,
  },
  reviewHeader: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  reviewTitle: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },
  reviewSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  reviewList: {
    flex: 1,
  },
  reviewListContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  reviewItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  reviewWordText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentBtn: {
    minWidth: 42,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewFooter: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  reviewSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewTotalLabel: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  reviewTotalValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  confirmReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.alias,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
  },
  confirmReviewBtnText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
});
