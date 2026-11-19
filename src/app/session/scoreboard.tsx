import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
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
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowRight,
  Copy,
  Dices,
  Download,
  Share2,
  Smartphone,
  Sparkles,
} from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import {
  buildShowCommentatorLine,
  computePartyAchievements,
  getTeamMascot,
} from '@/constants/mascots';
import { ConfettiCanvas } from '@/components/game/ConfettiCanvas';
import { ForfeitWheelModal } from '@/components/game/ForfeitWheelModal';
import { BalakaLogo } from '@/components/graphics/BalakaLogo';
import { SessionTopBar } from '@/components/game/SessionTopBar';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { usePartyStore } from '@/stores/usePartyStore';
import { playVictoryFanfare, triggerHaptic } from '@/utils/sound';

export default function ScoreboardScreen() {
  const router = useRouter();
  const storyPosterRef = useRef<any>(null);
  const [isForfeitOpen, setIsForfeitOpen] = useState(false);

  const sessionId = usePartyStore((s) => s.sessionId);
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
  const losingTeam =
    rankedTeams.length >= 2 ? rankedTeams[rankedTeams.length - 1] : null;
  const isTie =
    rankedTeams.length >= 2 &&
    rankedTeams[0].totalScore === rankedTeams[1].totalScore;
  const isSpyOnlySession = !hasTeamSteps && spyStats.roundsPlayed > 0;
  const leaderGap =
    rankedTeams.length >= 2
      ? rankedTeams[0].totalScore - rankedTeams[1].totalScore
      : 0;

  const currentStep = steps[currentStepIndex];
  const nextTeam = teams[currentTeamIndex];
  const reducedMotion = useReducedMotion();

  const forfeitTargetTeam = isTie ? rankedTeams[1] ?? losingTeam : losingTeam;
  const forfeitTargetMascot = forfeitTargetTeam
    ? getTeamMascot(
        forfeitTargetTeam.mascotId,
        forfeitTargetTeam.name,
        Math.max(0, rankedTeams.length - 1)
      )
    : undefined;

  const achievements = useMemo(
    () =>
      computePartyAchievements({
        totalGuessedWords,
        bestStreakCount,
        bestStreakTeamName,
        bestTurnPoints,
        bestTurnTeamName,
        bonusWordsGuessed,
        hardestUnansweredWord,
        spyRounds: spyStats.roundsPlayed,
        spyCitizensWins: spyStats.citizensWins,
        spyWins: spyStats.spyWins,
        isTie,
        leaderGap,
      }),
    [
      totalGuessedWords,
      bestStreakCount,
      bestStreakTeamName,
      bestTurnPoints,
      bestTurnTeamName,
      bonusWordsGuessed,
      hardestUnansweredWord,
      spyStats.roundsPlayed,
      spyStats.citizensWins,
      spyStats.spyWins,
      isTie,
      leaderGap,
    ]
  );

  const commentatorLine = useMemo(
    () =>
      buildShowCommentatorLine({
        rankedTeams,
        nextTeamName: nextTeam?.name,
        lastTurnTeamName: lastTurnInfo?.teamName,
        lastTurnDelta: lastTurnInfo?.pointsDelta,
        currentRoundInStep,
      }),
    [
      rankedTeams,
      nextTeam?.name,
      lastTurnInfo?.teamName,
      lastTurnInfo?.pointsDelta,
      currentRoundInStep,
    ]
  );

  useEffect(() => {
    if (!isCompleted) return;
    playVictoryFanfare();
    const effectiveSessionId =
      sessionId ||
      `legacy_${presetTitle || 'party'}_${totalGuessedWords}_${spyStats.roundsPlayed}_${rankedTeams
        .map((t) => t.totalScore)
        .join('_')}`;
    useHistoryStore.getState().addRecord({
      sessionId: effectiveSessionId,
      presetTitle: presetTitle || 'Вечірка Balaka',
      winnerName:
        hasTeamSteps && winnerTeam
          ? isTie && rankedTeams[1]
            ? `${rankedTeams[0].name} & ${rankedTeams[1].name}`
            : winnerTeam.name
          : isSpyOnlySession
            ? spyStats.citizensWins >= spyStats.spyWins
              ? 'Мирні детективи'
              : 'Шпигуни'
            : presetTitle || 'Balaka Party',
      winnerMascotId: hasTeamSteps ? winnerTeam?.mascotId : undefined,
      winnerScore: hasTeamSteps && winnerTeam ? winnerTeam.totalScore : 0,
      isTie: Boolean(hasTeamSteps && isTie),
      teams: hasTeamSteps
        ? rankedTeams.map((t) => ({
            name: t.name,
            mascotId: t.mascotId,
            score: t.totalScore,
          }))
        : [],
      totalGuessedWords,
      bestStreakCount,
      bestStreakTeamName,
      bestTurnPoints,
      hardestUnansweredWord,
      achievements: achievements.map((a) => `${a.emoji} ${a.title}`),
      spyRoundsPlayed: spyStats.roundsPlayed,
      spyCitizensWins: spyStats.citizensWins,
    });
  }, [
    isCompleted,
    sessionId,
    presetTitle,
    hasTeamSteps,
    winnerTeam,
    isTie,
    rankedTeams,
    isSpyOnlySession,
    totalGuessedWords,
    bestStreakCount,
    bestStreakTeamName,
    bestTurnPoints,
    hardestUnansweredWord,
    achievements,
    spyStats.roundsPlayed,
    spyStats.citizensWins,
    spyStats.spyWins,
  ]);

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
      `BALAKA · ПІДСУМКИ ВЕЧІРКИ «${presetTitle || 'Вечірка'}»`,
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

  const handleShareStoryPosterImage = async () => {
    triggerHaptic('medium');
    if (Platform.OS !== 'web' && storyPosterRef.current) {
      try {
        const uri = await (storyPosterRef.current.capture?.() ??
          captureRef(storyPosterRef as any, {
            format: 'png',
            quality: 0.95,
          }));
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Афіша вечора Balaka 9:16',
          });
          return;
        }
      } catch {
        // Fallback below
      }
    }
    await handleSharePartySummary();
  };

  const stepNum = String(Math.min(currentStepIndex + 1, steps.length)).padStart(
    2,
    '0'
  );
  const totalStepsNum = String(Math.max(1, steps.length)).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {isCompleted ? <ConfettiCanvas /> : null}
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

        {/* Show Commentator Live Line */}
        {!isCompleted && hasTeamSteps ? (
          <View style={styles.commentatorBar}>
            <Text style={styles.commentatorText}>{commentatorLine}</Text>
          </View>
        ) : null}

        {/* Standings List */}
        {hasTeamSteps ? (
          <View style={styles.leaderboardList}>
            {(() => {
              const maxScore = Math.max(
                1,
                ...rankedTeams.map((t) => Math.max(0, t.totalScore)),
              );
              return rankedTeams.map((team, idx) => {
                const isLeader = idx === 0 && team.totalScore > 0 && !isTie;
                const mascot = getTeamMascot(team.mascotId, team.name, idx);
                const progressPct = Math.round(
                  (Math.max(0, team.totalScore) / maxScore) * 100,
                );
                const rowContent = (
                  <>
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

                    <View
                      style={[
                        styles.rankMascotChip,
                        { backgroundColor: mascot.bgTint },
                      ]}
                    >
                      <Text style={styles.rankMascotEmoji}>{mascot.emoji}</Text>
                    </View>

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
                  </>
                );

                return (
                  <Animated.View
                    key={team.id}
                    layout={reducedMotion ? undefined : LinearTransition.springify()}
                  >
                    {isLeader ? (
                      <LinearGradient
                        colors={['#2D1A10', '#1E1619', '#151421']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.teamCard, styles.teamCardLeader]}
                      >
                        {rowContent}
                      </LinearGradient>
                    ) : (
                      <View style={styles.teamCard}>{rowContent}</View>
                    )}
                  </Animated.View>
                );
              });
            })()}
          </View>
        ) : null}

        {/* Dedicated Handoff Callout Block between turns */}
        {!isCompleted && nextTeam && currentStep ? (
          <LinearGradient
            colors={['#1F1733', '#131122']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.handoffCalloutCard}
          >
            <View style={styles.handoffIconRow}>
              <View style={styles.handoffIconCircle}>
                <Smartphone size={18} color="#C4B5FD" />
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
          </LinearGradient>
        ) : null}

        {/* Final Party Poster for Stories */}
        {isCompleted ? (
          <View style={styles.posterSection}>
            <Text style={styles.posterSectionOverline}>
              АФІША ВЕЧОРА ДЛЯ STORIES
            </Text>

            <ViewShot
              ref={storyPosterRef}
              options={{ format: 'png', quality: 0.95 }}
            >
              <LinearGradient
                colors={['#241B2D', '#171422', '#10101A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.posterCard}
              >
                {/* Top Brand Row */}
                <View style={styles.posterBrandRow}>
                  <View style={styles.posterBrandLockup}>
                    <BalakaLogo size={20} />
                    <Text style={styles.posterBrandName}>BALAKA</Text>
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
                        ? 'БОЙОВА НІЧИЯ ВЕЧОРА'
                        : 'ЧЕМПІОНИ ВЕЧІРКИ'
                      : 'МІСІЮ ЗАВЕРШЕНО'}
                  </Text>
                  <Text style={styles.posterWinnerName}>
                    {hasTeamSteps && winnerTeam
                      ? isTie
                        ? `${rankedTeams[0].name} & ${rankedTeams[1].name}`
                        : winnerTeam.name
                      : presetTitle || 'Balaka Party'}
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
                      {isSpyOnlySession ? spyStats.citizensWins : totalGuessedWords}
                    </Text>
                    <Text style={styles.posterStatCaption}>
                      {isSpyOnlySession ? 'Викрито шпигунів' : 'Відгадано слів'}
                    </Text>
                  </View>
                  <View style={styles.posterStatBox}>
                    <Text style={styles.posterStatNumber}>
                      {isSpyOnlySession ? spyStats.spyWins : steps.length}
                    </Text>
                    <Text style={styles.posterStatCaption}>
                      {isSpyOnlySession ? 'Перемог шпигуна' : 'Зіграно режимів'}
                    </Text>
                  </View>
                </View>

                {/* Unified Party Achievements & Records ("Нагороди та рекорди вечора") */}
                {(() => {
                  const hasFireAch = achievements.some((a) => a.id === 'on_fire');
                  const hasMachineGunAch = achievements.some((a) => a.id === 'machine_gun');
                  const hasHardcoreAch = achievements.some((a) => a.id === 'hardcore');
                  const hasSpyAch = achievements.some(
                    (a) => a.id === 'bluff_king' || a.id === 'detectives'
                  );

                  const extraRecords: { label: string; value: string }[] = [];
                  if (!hasFireAch && bestStreakCount >= 2 && bestStreakTeamName) {
                    extraRecords.push({
                      label: '🔥 Найкраща серія',
                      value: `${bestStreakTeamName} (${bestStreakCount} підряд)`,
                    });
                  }
                  if (!hasMachineGunAch && bestTurnPoints > 0 && bestTurnTeamName) {
                    extraRecords.push({
                      label: '⚡ Рекорд одного раунду',
                      value: `${bestTurnTeamName} (+${bestTurnPoints})`,
                    });
                  }
                  if (!hasHardcoreAch && bonusWordsGuessed > 0) {
                    extraRecords.push({
                      label: '💎 Хардкор-слова (3★)',
                      value: `${bonusWordsGuessed} слів`,
                    });
                  }
                  if (!hasSpyAch && !isSpyOnlySession && spyStats.roundsPlayed > 0) {
                    extraRecords.push({
                      label: '🕵️ Протокол «Шпигун»',
                      value: `Мирні ${spyStats.citizensWins} : ${spyStats.spyWins} Шпигун`,
                    });
                  }

                  if (achievements.length === 0 && extraRecords.length === 0) {
                    return null;
                  }

                  return (
                    <View style={styles.awardsCard}>
                      <Text style={styles.awardsTitle}>
                        🏆 НАГОРОДИ ТА РЕКОРДИ ВЕЧОРА
                      </Text>

                      {achievements.length > 0 ? (
                        <View style={styles.achievementsBadgesWrap}>
                          {achievements.map((ach) => (
                            <View key={ach.id} style={styles.achievementBadgeCard}>
                              <Text style={styles.achievementEmoji}>{ach.emoji}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.achievementTitle}>
                                  {ach.title}
                                </Text>
                                <Text style={styles.achievementDetail}>
                                  {ach.detail}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {extraRecords.map((rec) => (
                        <View
                          key={rec.label}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <Text
                            style={{
                              color: COLORS.textSecondary,
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {rec.label}
                          </Text>
                          <Text
                            style={{
                              color: COLORS.textPrimary,
                              fontSize: 13,
                              fontWeight: '800',
                            }}
                          >
                            {rec.value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* Word that broke the party */}
                {!isSpyOnlySession ? (
                  <View style={styles.brokenWordCard}>
                    <Text style={styles.brokenWordLabel}>
                      СЛОВО, ЯКЕ ЗЛАМАЛО ВЕЧІРКУ
                    </Text>
                    <Text style={styles.brokenWordValue}>
                      «{hardestUnansweredWord ?? 'Усе розгадали без промахів'}»
                    </Text>
                  </View>
                ) : null}
              </LinearGradient>
            </ViewShot>

            <View style={styles.posterActionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.sharePosterBtn}
                onPress={handleShareStoryPosterImage}
              >
                <Download size={16} color={COLORS.textPrimary} />
                <Text style={styles.sharePosterBtnText}>Stories PNG</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.copyPosterBtn}
                onPress={handleSharePartySummary}
              >
                <Share2 size={16} color={COLORS.textPrimary} />
                <Text style={styles.copyPosterBtnText}>Текст</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.copyPosterBtn}
                onPress={handleCopyPartySummary}
              >
                <Copy size={16} color={COLORS.textPrimary} />
                <Text style={styles.copyPosterBtnText}>Копія</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        {isCompleted ? (
          <View style={styles.completedActions}>
            {hasTeamSteps && forfeitTargetTeam ? (
              <TouchableOpacity
                activeOpacity={0.88}
                style={[styles.homeButton, styles.forfeitButton]}
                onPress={() => {
                  triggerHaptic('medium');
                  setIsForfeitOpen(true);
                }}
              >
                <View style={styles.forfeitInnerRow}>
                  <Dices size={18} color="#FB7185" />
                  <Text style={styles.forfeitButtonText} numberOfLines={1}>
                    {isTie
                      ? 'КОЛЕСО ФАНТІВ ДЛЯ НІЧИЄЇ!'
                      : `КОЛЕСО ФАНТІВ ДЛЯ: ${forfeitTargetTeam.name.toUpperCase()}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

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

      {forfeitTargetTeam ? (
        <ForfeitWheelModal
          visible={isForfeitOpen}
          onClose={() => setIsForfeitOpen(false)}
          targetTeamName={forfeitTargetTeam.name}
          targetMascot={forfeitTargetMascot}
        />
      ) : null}
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
    borderRadius: RADIUS.xl + 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderBottomWidth: 4,
    borderBottomColor: '#0D0B18',
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
  posterBrandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  commentatorBar: {
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.32)',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  commentatorText: {
    color: '#E9D5FF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  rankMascotChip: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankMascotEmoji: {
    fontSize: 17,
  },
  achievementsBadgesWrap: {
    gap: 6,
    marginBottom: 4,
  },
  achievementBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  achievementEmoji: {
    fontSize: 18,
  },
  achievementTitle: {
    color: COLORS.textPrimary,
    fontSize: 12.5,
    fontWeight: '800',
  },
  achievementDetail: {
    color: COLORS.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  forfeitButton: {
    backgroundColor: '#2D1422',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    borderBottomWidth: 5,
    borderBottomColor: '#190A13',
  },
  forfeitInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  forfeitButtonText: {
    color: '#FFE4E6',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
});
