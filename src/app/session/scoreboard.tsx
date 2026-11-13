import React, { useMemo } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  ArrowRight,
  Copy,
  Flame,
  Home,
  Share2,
  Skull,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { usePartyStore } from '@/stores/usePartyStore';

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
  const lastTurnInfo = usePartyStore((s) => s.lastTurnInfo);
  const endSession = usePartyStore((s) => s.endSession);

  const hasTeamSteps = useMemo(
    () => steps.some((step) => step.scoring.type === 'team'),
    [steps]
  );

  // Рахуємо сумарний бал кожної команди по всіх групах
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

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/session/orchestrator');
  };

  const handleExitToHome = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    endSession();
    router.replace('/');
  };

  const buildPartySummaryText = () => {
    const lines: string[] = [
      `🎉 KOLO • ПІДСУМКИ ВЕЧІРКИ «${presetTitle || 'Вечірка'}»`,
      '',
    ];

    if (hasTeamSteps && rankedTeams.length > 0) {
      rankedTeams.forEach((team, idx) => {
        const prefix = idx === 0 ? '👑' : `${idx + 1}.`;
        lines.push(`${prefix} ${team.name} — ${team.totalScore} балів`);
      });
      lines.push('');
    }

    lines.push(`⚡ Відгадано слів за вечір: ${totalGuessedWords}`);
    lines.push(
      `💀 Слово, яке зламало вечірку: «${hardestUnansweredWord ?? 'Усе розгадали без промахів!'}»`
    );

    return lines.join('\n');
  };

  const handleSharePartySummary = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Скопійовано!',
      'Підсумки вечірки скопійовано в буфер обміну.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {!isCompleted ? (
        <SessionTopBar
          stepBadgeText={`РАХУНОК • КРОК ${Math.min(currentStepIndex + 1, steps.length)}/${steps.length}`}
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
            <Zap size={18} color={COLORS.crocodile} />
            <Text style={styles.lastTurnText}>
              Хід завершено:{' '}
              <Text style={styles.lastTurnHighlight}>{lastTurnInfo.teamName}</Text>{' '}
              ({lastTurnInfo.pointsDelta >= 0 ? `+${lastTurnInfo.pointsDelta}` : lastTurnInfo.pointsDelta} балів)
            </Text>
          </View>
        ) : null}

        {/* Header */}
        <View style={styles.headerBlock}>
          <View style={styles.trophyBadge}>
            <Trophy
              size={28}
              color={isCompleted ? COLORS.hot : COLORS.primary}
            />
          </View>
          <Text style={styles.title}>
            {isCompleted ? 'Фінал вечірки!' : 'Турнірна таблиця'}
          </Text>
          <Text style={styles.subtitle}>
            {isCompleted
              ? `Сценарій «${presetTitle || 'Вечірка'}» успішно пройдено!`
              : nextTeam && currentStep
                ? `Далі готується: ${nextTeam.name} (Коло ${currentRoundInStep})`
                : 'Проміжні результати команд'}
          </Text>
        </View>

        {/* Standings List */}
        {hasTeamSteps ? (
          <View style={styles.leaderboardList}>
            {rankedTeams.map((team, idx) => {
              const isLeader = idx === 0 && team.totalScore > 0;
              return (
                <View
                  key={team.id}
                  style={[
                    styles.teamCard,
                    isLeader && styles.teamCardLeader,
                  ]}
                >
                  <View
                    style={[
                      styles.rankCircle,
                      isLeader && {
                        backgroundColor: `${COLORS.hot}28`,
                        borderColor: COLORS.hot,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankText,
                        isLeader && { color: COLORS.hot },
                      ]}
                    >
                      {idx === 0 ? '👑' : `#${idx + 1}`}
                    </Text>
                  </View>

                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.teamSubScore}>
                      Загальний залік вечірки
                    </Text>
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
                    <Text style={styles.scoreLabel}>балів</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Final Party Poster for Stories (Iteration 4) */}
        {isCompleted ? (
          <View style={styles.posterSection}>
            <View style={styles.posterHeaderRow}>
              <Sparkles size={16} color={COLORS.primary} />
              <Text style={styles.posterSectionTitle}>
                ПОСТЕР ВЕЧІРКИ ДЛЯ STORIES
              </Text>
            </View>

            <LinearGradient
              colors={['#1E1538', '#0F0D19', '#190E26']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.posterCard}
            >
              {/* Top Brand Row */}
              <View style={styles.posterBrandRow}>
                <View style={styles.posterLogoPill}>
                  <Sparkles size={13} color={COLORS.primary} />
                  <Text style={styles.posterLogoText}>KOLO • PARTY HUB</Text>
                </View>
                <Text style={styles.posterPresetTag}>
                  {presetTitle || 'Вечірка'}
                </Text>
              </View>

              {/* Winner Highlight */}
              <View style={styles.posterMainBlock}>
                <Text style={styles.posterWinnerLabel}>
                  {hasTeamSteps
                    ? isTie
                      ? '🔥 БОЙОВА НІЧИЯ ВЕЧОРА'
                      : '🏆 ЧЕМПІОНИ ВЕЧІРКИ'
                    : '🕵️ МІСІЮ ЗАВЕРШЕНО'}
                </Text>
                <Text style={styles.posterWinnerName}>
                  {hasTeamSteps && winnerTeam
                    ? isTie
                      ? `${rankedTeams[0].name} & ${rankedTeams[1].name}`
                      : winnerTeam.name
                    : presetTitle || 'KOLO Party'}
                </Text>
                {hasTeamSteps && winnerTeam ? (
                  <View style={styles.posterScorePill}>
                    <Flame size={15} color={COLORS.hot} />
                    <Text style={styles.posterScorePillText}>
                      Рекордний рахунок: {winnerTeam.totalScore} балів
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Stats Grid */}
              <View style={styles.posterStatsRow}>
                <View style={styles.posterStatBox}>
                  <Text style={styles.posterStatNumber}>{totalGuessedWords}</Text>
                  <Text style={styles.posterStatCaption}>
                    Відгадано за вечір
                  </Text>
                </View>
                <View style={styles.posterStatBox}>
                  <Text style={styles.posterStatNumber}>{steps.length}</Text>
                  <Text style={styles.posterStatCaption}>
                    Зіграно раундів-ігор
                  </Text>
                </View>
              </View>

              {/* Word that broke the party */}
              <View style={styles.brokenWordCard}>
                <View style={styles.brokenWordHeader}>
                  <Skull size={15} color={COLORS.spy} />
                  <Text style={styles.brokenWordLabel}>
                    СЛОВО, ЯКЕ ЗЛАМАЛО ВЕЧІРКУ:
                  </Text>
                </View>
                <Text style={styles.brokenWordValue}>
                  «{hardestUnansweredWord ?? 'Усе розгадали без промахів! 🔥'}»
                </Text>
              </View>

              <Text style={styles.posterWatermark}>
                Зроби скріншот та тегай друзів у Stories 📸
              </Text>
            </LinearGradient>

            <View style={styles.posterActionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.sharePosterBtn}
                onPress={handleSharePartySummary}
              >
                <Share2 size={18} color={COLORS.textPrimary} />
                <Text style={styles.sharePosterBtnText}>
                  Поділитися підсумками
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.copyPosterBtn}
                onPress={handleCopyPartySummary}
              >
                <Copy size={18} color={COLORS.primary} />
                <Text style={styles.copyPosterBtnText}>Скопіювати</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        {isCompleted ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.homeButton}
            onPress={handleExitToHome}
          >
            <Home size={20} color={COLORS.textPrimary} />
            <Text style={styles.homeButtonText}>Завершити та на головну</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>
              {nextTeam
                ? `Наступний хід: ${nextTeam.name}`
                : 'Продовжити вечірку'}
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
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.xl,
  },
  lastTurnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: `${COLORS.crocodile}18`,
    borderWidth: 1,
    borderColor: `${COLORS.crocodile}55`,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  lastTurnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  lastTurnHighlight: {
    color: COLORS.crocodile,
    fontWeight: '800',
  },
  headerBlock: {
    alignItems: 'center',
    gap: 6,
  },
  trophyBadge: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  leaderboardList: {
    gap: SPACING.sm,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  teamCardLeader: {
    borderColor: `${COLORS.hot}88`,
    backgroundColor: `${COLORS.hot}12`,
  },
  rankCircle: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '800',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  teamSubScore: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    color: COLORS.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },

  // Poster Styles
  posterSection: {
    gap: SPACING.sm,
  },
  posterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  posterSectionTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  posterCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: `${COLORS.primary}88`,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  posterBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  posterLogoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  posterLogoText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  posterPresetTag: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  posterMainBlock: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  posterWinnerLabel: {
    color: COLORS.hot,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  posterWinnerName: {
    color: COLORS.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  posterScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.hot}22`,
    borderWidth: 1,
    borderColor: `${COLORS.hot}66`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  posterScorePillText: {
    color: COLORS.hot,
    fontSize: 13,
    fontWeight: '800',
  },
  posterStatsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  posterStatBox: {
    flex: 1,
    backgroundColor: 'rgba(22, 20, 33, 0.75)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  posterStatNumber: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  posterStatCaption: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  brokenWordCard: {
    backgroundColor: `${COLORS.spy}18`,
    borderWidth: 1,
    borderColor: `${COLORS.spy}66`,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  brokenWordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brokenWordLabel: {
    color: COLORS.spy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  brokenWordValue: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  posterWatermark: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
  },
  continueButtonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
  },
  homeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  posterActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  sharePosterBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.crocodile,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
  },
  sharePosterBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  copyPosterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
  },
  copyPosterBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
