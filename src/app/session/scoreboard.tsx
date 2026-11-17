import React, { useEffect, useMemo } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowRight,
  Copy,
  Share2,
  Smartphone,
  Sparkles,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { usePartyStore } from '@/stores/usePartyStore';
import { playVictoryFanfare, triggerHaptic } from '@/utils/sound';

const CONFETTI_PIECES = [
  { left: '8%', color: '#F97316', delay: 0 },
  { left: '20%', color: '#10B981', delay: 140 },
  { left: '34%', color: '#3B82F6', delay: 260 },
  { left: '48%', color: '#A855F7', delay: 80 },
  { left: '62%', color: '#F43F5E', delay: 200 },
  { left: '76%', color: '#FACC15', delay: 120 },
  { left: '90%', color: '#10B981', delay: 300 },
];

function ConfettiPiece({
  left,
  color,
  delay,
  reducedMotion,
}: {
  left: string;
  color: string;
  delay: number;
  reducedMotion: boolean;
}) {
  const translateY = useSharedValue(-16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    translateY.value = withDelay(delay, withTiming(110, { duration: 1900 }));
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 1600 })
      )
    );
  }, [delay, opacity, translateY, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { rotateZ: '18deg' }],
  }));

  if (reducedMotion) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: left as any,
          width: 8,
          height: 16,
          borderRadius: 4,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

export default function ScoreboardScreen() {
  const router = useRouter();

  const isCompleted = usePartyStore((s) => s.isCompleted);
  const presetTitle = usePartyStore((s) => s.presetTitle);
  const steps = usePartyStore((s) => s.steps);
  const currentStepIndex = usePartyStore((s) => s.currentStepIndex);
  const teams = usePartyStore((s) => s.teams);
  const currentTeamIndex = usePartyStore((s) => s.currentTeamIndex);
  const currentRoundInStep = usePartyStore((s) => s.currentRoundInStep);
  const totalGuessedWords = usePartyStore((s) => s.totalGuessedWords);
  const hardestUnansweredWord = usePartyStore((s) => s.hardestUnansweredWord);
  const bestStreakCount = usePartyStore((s) => s.bestStreakCount);
  const bestStreakTeamName = usePartyStore((s) => s.bestStreakTeamName);
  const bestTurnPoints = usePartyStore((s) => s.bestTurnPoints);
  const bestTurnTeamName = usePartyStore((s) => s.bestTurnTeamName);
  const bonusWordsGuessed = usePartyStore((s) => s.bonusWordsGuessed);
  const lastTurnInfo = usePartyStore((s) => s.lastTurnInfo);
  const spyStats = usePartyStore((s) => s.spyStats);
  const restartRematch = usePartyStore((s) => s.restartRematch);
  const endSession = usePartyStore((s) => s.endSession);

  const hasTeamSteps = useMemo(
    () => steps.some((step) => step.scoring.type === 'team'),
    [steps]
  );

  const rankedTeams = useMemo(() => {
    return [...teams]
      .map((team) => {
        const totalScore = Object.values(team.scoresByGroup).reduce(
          (acc, val) => acc + val,
          0
        );
        return { ...team, totalScore };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [teams]);

  const winnerTeam = rankedTeams[0];
  const isTie =
    rankedTeams.length >= 2 &&
    rankedTeams[0].totalScore === rankedTeams[1].totalScore &&
    rankedTeams[0].totalScore > 0;

  const currentStep = steps[currentStepIndex];
  const nextTeam = teams[currentTeamIndex];
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (isCompleted) {
      playVictoryFanfare();
    }
  }, [isCompleted]);

  const handleContinue = () => {
    triggerHaptic('heavy');
    router.replace('/session/orchestrator');
  };

  const handleRematch = () => {
    triggerHaptic('heavy');
    restartRematch();
    router.replace('/session/orchestrator');
  };

  const handleExitToHome = () => {
    triggerHaptic('success');
    endSession();
    router.replace('/');
  };

  const buildPartySummaryText = () => {
    const lines: string[] = [
      `KOLO · ПІДСУМКИ ВЕЧІРКИ «${presetTitle || 'Вечірка'}»`,
      '',
    ];

    if (hasTeamSteps && rankedTeams.length > 0) {
      rankedTeams.forEach((team, idx) => {
        lines.push(`0${idx + 1}. ${team.name} — ${team.totalScore} балів`);
      });
      lines.push('');
    }

    lines.push(`Відгадано за вечір: ${totalGuessedWords}`);
    if (bestStreakCount >= 2 && bestStreakTeamName) {
      lines.push(`🔥 Серійна машина: ${bestStreakTeamName} (${bestStreakCount} слів підряд)`);
    }
    if (bestTurnPoints > 0 && bestTurnTeamName) {
      lines.push(`⚡ Рекорд раунду: ${bestTurnTeamName} (+${bestTurnPoints} за хід)`);
    }
    if (bonusWordsGuessed > 0) {
      lines.push(`💎 Розгадано хардкору (3★): ${bonusWordsGuessed}`);
    }
    if (spyStats.roundsPlayed > 0) {
      lines.push(`🕵️ Шпигун: мирні викрили ${spyStats.citizensWins} з ${spyStats.roundsPlayed}`);
    }
    lines.push(
      `Слово, яке зламало вечірку: «${hardestUnansweredWord ?? 'Усе розгадали без промахів'}»`
    );

    return lines.join('\n');
  };

  const handleSharePartySummary = async () => {
    triggerHaptic('medium');
    const message = buildPartySummaryText();
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      Alert.alert(
        'Скопійовано в буфер',
        'Текст підсумків вечірки скопійовано!'
      );
    }
  };

  const handleCopyPartySummary = async () => {
    const message = buildPartySummaryText();
    await Clipboard.setStringAsync(message);
    triggerHaptic('success');
    Alert.alert(
      'Скопійовано!',
      'Підсумки вечірки скопійовано в буфер обміну.'
    );
  };

  const stepNum = String(Math.min(currentStepIndex + 1, steps.length)).padStart(
    2,
    '0'
  );
  const totalStepsNum = String(Math.max(1, steps.length)).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {!isCompleted ? (
        <SessionTopBar
          stepBadgeText={`РАХУНОК · ${stepNum} / ${totalStepsNum}`}
          accentColor={COLORS.primary}
        />
      ) : null}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner of Last Turn (if intermediate) */}
        {!isCompleted && lastTurnInfo ? (
          <View style={styles.lastTurnBanner}>
            <View>
              <Text style={styles.lastTurnOverline}>ПІДСУМОК ХОДУ</Text>
              <Text style={styles.lastTurnTeamName}>{lastTurnInfo.teamName}</Text>
            </View>
            <Text
              style={[
                styles.lastTurnDelta,
                lastTurnInfo.pointsDelta > 0 && { color: COLORS.crocodile },
                lastTurnInfo.pointsDelta < 0 && { color: COLORS.spy },
              ]}
            >
              {lastTurnInfo.pointsDelta >= 0
                ? `+${lastTurnInfo.pointsDelta}`
                : lastTurnInfo.pointsDelta}
            </Text>
          </View>
        ) : null}

        {/* Editorial Header */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(200)}
          style={styles.headerBlock}
        >
          {isCompleted ? (
            <View pointerEvents="none" style={styles.confettiWrap}>
              {CONFETTI_PIECES.map((p, idx) => (
                <ConfettiPiece
                  key={idx}
                  left={p.left}
                  color={p.color}
                  delay={p.delay}
                  reducedMotion={Boolean(reducedMotion)}
                />
              ))}
            </View>
          ) : null}
          <View style={styles.headerTagRow}>
            {isCompleted ? <Sparkles size={13} color={COLORS.hot} /> : null}
            <Text style={[styles.overline, isCompleted && { color: COLORS.hot }]}>
              {isCompleted ? 'ФІНАЛ ШОУ · ВІТАЄМО ЧЕМПІОНІВ!' : 'ТУРНІРНА ТАБЛИЦЯ'}
            </Text>
          </View>
          <Text style={styles.title}>
            {isCompleted ? presetTitle || 'Фінал гри' : 'Рахунок команд'}
          </Text>
        </Animated.View>

        {/* Standings List */}
        {hasTeamSteps ? (
          <View style={styles.leaderboardList}>
            {(() => {
              const maxScore = Math.max(
                1,
                ...rankedTeams.map((t) => Math.max(0, t.totalScore)),
              );
              return rankedTeams.map((team, idx) => {
                const isLeader = idx === 0 && team.totalScore > 0;
                const progressPct = Math.round(
                  (Math.max(0, team.totalScore) / maxScore) * 100,
                );
                return (
                  <View
                    key={team.id}
                    style={[
                      styles.teamCard,
                      isLeader && styles.teamCardLeader,
                    ]}
                  >
                    {isLeader ? (
                      <View
                        style={[
                          styles.leaderAccentStrip,
                          { backgroundColor: COLORS.hot },
                        ]}
                      />
                    ) : null}

                    <Text
                      style={[
                        styles.rankText,
                        isLeader && { color: COLORS.hot },
                      ]}
                    >
                      0{idx + 1}
                    </Text>

                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName}>{team.name}</Text>
                      {isLeader ? (
                        <Text style={styles.leaderSubLabel}>ЛІДЕР ВЕЧОРА</Text>
                      ) : null}
                      <View style={styles.teamProgressTrack}>
                        <View
                          style={[
                            styles.teamProgressFill,
                            {
                              width: `${progressPct}%`,
                              backgroundColor: isLeader
                                ? COLORS.hot
                                : COLORS.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.scoreBox}>
                      <Text
                        style={[
                          styles.scoreValue,
                          isLeader && { color: COLORS.hot },
                        ]}
                      >
                        {team.totalScore}
                      </Text>
                    </View>
                  </View>
                );
              });
            })()}
          </View>
        ) : null}

        {/* Dedicated Handoff Callout Block between turns */}
        {!isCompleted && nextTeam && currentStep ? (
          <View style={styles.handoffCalloutCard}>
            <View style={styles.handoffIconRow}>
              <View style={styles.handoffIconCircle}>
                <Smartphone size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.handoffOverline}>
                ПЕРЕДАЧА ТЕЛЕФОНА · КОЛО {currentRoundInStep}
              </Text>
            </View>
            <Text style={styles.handoffTeamHeadline}>
              Тепер {nextTeam.name}!
            </Text>
            <Text style={styles.handoffSubText}>
              Передайте телефон ведучому команди «{nextTeam.name}» для наступного
              раунду.
            </Text>
          </View>
        ) : null}

        {/* Final Party Poster for Stories */}
        {isCompleted ? (
          <View style={styles.posterSection}>
            <Text style={styles.posterSectionOverline}>
              АФІША ВЕЧОРА ДЛЯ STORIES
            </Text>

            <LinearGradient
              colors={['#1E1C2A', '#14131D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.posterCard}
            >
              {/* Top Brand Row */}
              <View style={styles.posterBrandRow}>
                <Text style={styles.posterBrandName}>KOLO</Text>
                <Text style={styles.posterPresetTag}>
                  {presetTitle || 'Вечірка'}
                </Text>
              </View>

              {/* Winner Highlight */}
              <View style={styles.posterMainBlock}>
                <Text style={styles.posterWinnerLabel}>
                  {hasTeamSteps
                    ? isTie
                      ? 'БОЙОВА НІЧИЯ ВЕЧОРА'
                      : 'ЧЕМПІОНИ ВЕЧІРКИ'
                    : 'МІСІЮ ЗАВЕРШЕНО'}
                </Text>
                <Text style={styles.posterWinnerName}>
                  {hasTeamSteps && winnerTeam
                    ? isTie
                      ? `${rankedTeams[0].name} & ${rankedTeams[1].name}`
                      : winnerTeam.name
                    : presetTitle || 'KOLO Party'}
                </Text>
                {hasTeamSteps && winnerTeam ? (
                  <Text style={styles.posterScoreSub}>
                    Підсумковий рахунок: {winnerTeam.totalScore} балів
                  </Text>
                ) : null}
              </View>

              {/* Stats Grid */}
              <View style={styles.posterStatsRow}>
                <View style={styles.posterStatBox}>
                  <Text style={styles.posterStatNumber}>
                    {totalGuessedWords}
                  </Text>
                  <Text style={styles.posterStatCaption}>Відгадано слів</Text>
                </View>
                <View style={styles.posterStatBox}>
                  <Text style={styles.posterStatNumber}>{steps.length}</Text>
                  <Text style={styles.posterStatCaption}>Зіграно режимів</Text>
                </View>
              </View>

              {/* Party Awards ("Оскари Вечірки") */}
              {(bestStreakCount >= 2 || bestTurnPoints > 0 || bonusWordsGuessed > 0 || spyStats.roundsPlayed > 0) ? (
                <View style={styles.awardsCard}>
                  <Text style={styles.awardsTitle}>
                    🏆 НОМІНАЦІЇ ТА ОСКАРИ ВЕЧІРКИ
                  </Text>

                  {bestStreakCount >= 2 && bestStreakTeamName ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        🔥 Серійна машина
                      </Text>
                      <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' }}>
                        {bestStreakTeamName} ({bestStreakCount} підряд)
                      </Text>
                    </View>
                  ) : null}

                  {bestTurnPoints > 0 && bestTurnTeamName ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        ⚡ Рекорд одного раунду
                      </Text>
                      <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' }}>
                        {bestTurnTeamName} (+{bestTurnPoints})
                      </Text>
                    </View>
                  ) : null}

                  {bonusWordsGuessed > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        💎 Мисливці за хардкором (3★)
                      </Text>
                      <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' }}>
                        {bonusWordsGuessed} слів
                      </Text>
                    </View>
                  ) : null}

                  {spyStats.roundsPlayed > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        🕵️ Протокол «Шпигун»
                      </Text>
                      <Text style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' }}>
                        Мирні {spyStats.citizensWins} : {spyStats.spyWins} Шпигун
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Word that broke the party */}
              <View style={styles.brokenWordCard}>
                <Text style={styles.brokenWordLabel}>
                  СЛОВО, ЯКЕ ЗЛАМАЛО ВЕЧІРКУ
                </Text>
                <Text style={styles.brokenWordValue}>
                  «{hardestUnansweredWord ?? 'Усе розгадали без промахів'}»
                </Text>
              </View>
            </LinearGradient>

            <View style={styles.posterActionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.sharePosterBtn}
                onPress={handleSharePartySummary}
              >
                <Share2 size={17} color={COLORS.textPrimary} />
                <Text style={styles.sharePosterBtnText}>Поділитися</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.copyPosterBtn}
                onPress={handleCopyPartySummary}
              >
                <Copy size={17} color={COLORS.textPrimary} />
                <Text style={styles.copyPosterBtnText}>Скопіювати</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        {isCompleted ? (
          <View style={styles.completedActions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.homeButton, styles.rematchButton]}
              onPress={handleRematch}
            >
              <Text style={[styles.homeButtonText, styles.rematchButtonText]}>
                🔥 ЗІГРАТИ РЕВАНШ (ТІ САМІ КОМАНДИ)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.homeButton, styles.exitHomeButton]}
              onPress={handleExitToHome}
            >
              <Text style={styles.homeButtonText}>ЗАВЕРШИТИ ТА НА ГОЛОВНУ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.continueButton}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel={
              nextTeam ? `${nextTeam.name}, ваш вихід` : 'Продовжити вечірку'
            }
          >
            <Text style={styles.continueButtonText} numberOfLines={1}>
              {nextTeam
                ? `${nextTeam.name.toUpperCase()}, ВАШ ВИХІД!`
                : 'ПРОДОВЖИТИ ВЕЧІРКУ'}
            </Text>
            <ArrowRight size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.lg,
  },
  lastTurnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  lastTurnOverline: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginBottom: 2,
  },
  lastTurnTeamName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  lastTurnDelta: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  headerBlock: {
    gap: 4,
  },
  overline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  leaderboardList: {
    gap: 8,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    paddingHorizontal: SPACING.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  teamCardLeader: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  leaderAccentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  rankText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 24,
    fontVariant: ['tabular-nums'],
  },
  teamInfo: {
    flex: 1,
    gap: 5,
  },
  teamProgressTrack: {
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
    marginTop: 2,
  },
  teamProgressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  teamName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  leaderSubLabel: {
    color: COLORS.hot,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },

  // Handoff Callout Block
  handoffCalloutCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderBottomWidth: 4,
    borderBottomColor: '#13131A',
    padding: SPACING.xl,
    gap: 8,
  },
  handoffIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  handoffIconCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoffOverline: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  handoffTeamHeadline: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  handoffSubText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },

  // Poster Styles
  posterSection: {
    gap: SPACING.md,
  },
  posterSectionOverline: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  posterCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    borderBottomWidth: 5,
    borderBottomColor: '#111018',
    padding: SPACING.xl,
    gap: SPACING.xl,
  },
  posterBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  posterBrandName: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  posterPresetTag: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  posterMainBlock: {
    paddingVertical: SPACING.xs,
  },
  posterWinnerLabel: {
    color: COLORS.hot,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  posterWinnerName: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 38,
  },
  posterScoreSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
  },
  posterStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  posterStatBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
  },
  posterStatNumber: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  posterStatCaption: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  brokenWordCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: 6,
  },
  brokenWordLabel: {
    color: COLORS.spy,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  brokenWordValue: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  posterActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sharePosterBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipNeutral,
    height: 48,
    borderRadius: RADIUS.md,
  },
  sharePosterBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  copyPosterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.lipNeutral,
    height: 48,
    borderRadius: RADIUS.md,
  },
  copyPosterBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  confettiWrap: {
    position: 'absolute',
    top: -8,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 10,
  },
  headerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  awardsCard: {
    backgroundColor: 'rgba(11, 11, 16, 0.55)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.28)',
    padding: SPACING.md,
    gap: 8,
  },
  awardsTitle: {
    color: COLORS.hot,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  completedActions: {
    gap: 10,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    minHeight: 60,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderBottomWidth: 5,
    borderBottomColor: '#6D28D9',
  },
  continueButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    flexShrink: 1,
  },
  homeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    minHeight: 58,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderBottomWidth: 5,
    borderBottomColor: '#6D28D9',
  },
  rematchButton: {
    backgroundColor: COLORS.hot,
    borderBottomColor: COLORS.lipHot,
  },
  rematchButtonText: {
    color: COLORS.background,
  },
  exitHomeButton: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 5,
    borderBottomColor: COLORS.lipNeutral,
  },
  homeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
